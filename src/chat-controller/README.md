# chat-controller

Microservicio de chat grupal en tiempo real de LumInsieme.

Un grupo tiene un cupo máximo fijado al crearlo. Los mensajes se persisten en
PostgreSQL, así que sobreviven al cierre de sesión de todos los participantes.

**Stack:** Node.js 22 · Express 4 · `ws` · PostgreSQL (`pg`) · Redis (`ioredis`) · JWT

---

## Decisión de arquitectura: dónde vive cada dato

`AGENTES.md` describe Redis como almacenamiento de los chats grupales y lo
define como *no persistente*. Eso choca con el requisito de que los mensajes
sobrevivan al fin de todas las sesiones: Redis en su configuración por defecto
pierde datos ante un reinicio y expulsa claves cuando se llena la memoria.

El reparto que implementa este módulo:

| Dato | Dónde | Por qué |
|---|---|---|
| Mensajes, grupos, membresías | **PostgreSQL** | Fuente de verdad. Durable, transaccional, es lo único que garantiza la persistencia pedida. |
| Últimos 50 mensajes por chat | **Redis** (caché) | Primera pantalla del chat en <200 ms sin tocar la base. Se puede perder sin consecuencias. |
| Presencia (quién está conectado) | **Redis** (efímero) | Es información volátil por naturaleza; caduca sola. |
| Fan-out entre instancias | **Redis Pub/Sub** | Permite escalar horizontalmente sin acoplar réplicas entre sí. |

Redis nunca es fuente de verdad. Si se cae, el chat sigue funcionando contra
PostgreSQL: se pierde caché y alcance entre instancias, no mensajes.

---

## Puesta en marcha

```bash
cd src/chat-controller
docker compose up -d        # PostgreSQL + Redis
npm install
cp .env.example .env        # completar DATABASE_URL y JWT_SECRET
npm run migrar              # aplica las migraciones pendientes
npm run dev
```

`JWT_SECRET` **debe ser idéntico** al de `login-controller`: este servicio no
emite tokens, solo verifica los que aquel firma.

Puerto por defecto: `4002` (login-controller usa el `4000`).

---

## Migraciones

El esquema vive en `db/migraciones/`, un archivo por cambio, aplicados en orden
de nombre y registrados en la tabla `schema_migraciones`.

```bash
npm run migrar          # aplica las pendientes
npm run migrar:estado   # muestra qué está aplicado y qué falta
```

Tres propiedades del ejecutor que importan:

- **Cada migración corre en su propia transacción.** Si una falla, esa queda sin
  aplicar y las anteriores se conservan; no hay estados a medias.
- **Un lock consultivo** (`pg_advisory_lock`) impide que dos instancias
  arrancando a la vez apliquen la misma migración en paralelo.
- **Se guarda el checksum de cada migración aplicada.** Si alguien edita un
  archivo ya aplicado, el arranque falla con un error explícito. Sin esa
  verificación el cambio no se ejecutaría nunca y las bases del equipo quedarían
  distintas en silencio — el tipo de problema que aparece semanas después y
  cuesta horas encontrar.

Para cambiar el esquema: **nunca edites una migración aplicada**, agregá una
nueva con el `ALTER`.

---

## Tareas de mantenimiento

Cada hora, una sola instancia a la vez (`pg_try_advisory_lock`, sin espera: si
otra la está corriendo, esta se saltea el turno) purga:

- **Invitaciones pendientes vencidas.** Ya se filtran al leer, pero la fila
  bloquea el índice único parcial de «una pendiente por persona y grupo», así
  que sin borrarla nadie podría volver a invitar a esa persona nunca más.
- **Invitaciones resueltas** más antiguas que `RETENCION_INVITACIONES_DIAS`
  (30 por defecto).

Se puede desactivar con `MANTENIMIENTO_HABILITADO=false`.

---

## Modelo de datos

```
chat_grupos ──1:N── chat_miembros
     │
     ├────1:N──── chat_mensajes
     │
     └────1:N──── chat_invitaciones
```

Todas las claves foráneas son `ON DELETE CASCADE`: borrar el grupo arrastra
mensajes, membresías e invitaciones en una sola operación atómica.

Tres decisiones del esquema que no son evidentes:

**1. `chat_grupos.ultimo_seq` + `chat_mensajes.seq`.**
Cada mensaje recibe un número correlativo *por chat*, no un `id` global. El
`BIGSERIAL` no sirve para ordenar: las secuencias se asignan al `INSERT` y no al
`COMMIT`, de modo que el mensaje 9 puede hacerse visible *después* del 10. Un
cursor de paginación que ya pasó por el 10 se saltaría el 9 para siempre. El
`seq` se asigna bajo el lock del grupo, así que su orden es el orden real de
confirmación.

**2. Índice único `(chat_id, autor_id, client_msg_id)`.**
El cliente genera un UUID por mensaje. Si la red se corta antes del ACK y
reintenta, el mismo UUID devuelve el mensaje ya guardado en vez de duplicarlo.

**3. `chat_miembros.salio_en` en vez de borrar la fila.**
Permite reingreso, conserva la atribución del historial y mantiene el cursor de
lectura. El índice parcial `WHERE salio_en IS NULL` hace que contar el cupo siga
siendo barato.

---

## Flujos

### Crear grupo

```
POST /api/chats  { nombre, maxMiembros, eventoId? }
   │
   └─ BEGIN
      ├─ INSERT chat_grupos          (UNIQUE evento_id evita dos chats por evento)
      ├─ INSERT chat_miembros        (el creador entra como admin)
      └─ INSERT mensaje de sistema
      COMMIT
```

### Unirse (control de cupo)

```
POST /api/chats/:id/miembros
   │
   └─ BEGIN
      ├─ SELECT ... FROM chat_grupos WHERE id = $1 FOR UPDATE   ← serializa
      ├─ ¿ya es miembro activo? → devuelve 200, no consume cupo
      ├─ COUNT miembros activos ≥ max_miembros → 409 CUPO_LLENO
      ├─ INSERT/UPDATE chat_miembros
      └─ INSERT mensaje de sistema
      COMMIT
   │
   └─ difundir alta por el bus
```

El `FOR UPDATE` es lo que hace correcto el cupo. Sin él, dos personas que entran
al mismo tiempo leen ambas «queda 1 lugar», ambas insertan, y el grupo termina
con un miembro de más.

### Enviar mensaje

```
Cliente A                  Instancia 1              PostgreSQL         Redis
   │                            │                        │               │
   │ ws {tipo:"mensaje",        │                        │               │
   │     clientMsgId:UUID}      │                        │               │
   ├───────────────────────────►│                        │               │
   │                            │ BEGIN                  │               │
   │                            ├─ FOR UPDATE grupo ────►│               │
   │                            ├─ ¿es miembro activo?  ►│               │
   │                            ├─ ¿ya existe ese UUID? ►│  idempotencia │
   │                            ├─ ultimo_seq + 1 ──────►│               │
   │                            ├─ INSERT mensaje ──────►│               │
   │                            │ COMMIT                 │               │
   │◄───── ack {seq, id} ───────┤                        │               │
   │                            ├─ RPUSH recientes ──────────────────────►│
   │                            ├─ PUBLISH evento ───────────────────────►│
   │                            │                                        │
   │                       ┌────┴──────────────── suscripción ───────────┤
   │◄── mensaje ───────────┤  Instancia 1                                │
Cliente B ◄── mensaje ─────┤  Instancia 2 (otros miembros del grupo)      │
```

Dos detalles del diagrama que importan:

- **La caché se escribe después del `COMMIT`.** Al revés, un `ROLLBACK` dejaría
  mensajes fantasma en Redis que nunca existieron en la base.
- **Quien publica no entrega a sus propios sockets.** Todas las instancias,
  incluida la emisora, entregan al *recibir* la publicación. El camino es
  idéntico para todos y no hace falta deduplicar.

El ACK viaja directo al autor (no por el bus) porque solo a él le sirve: le
confirma la persistencia y le da el `seq` con el que sustituye su mensaje
optimista en pantalla.

### Reconexión

El cliente guarda el último `seq` que recibió. Al reconectar:

```
ws {tipo:"suscribir", chatId, desdeSeq: 812}
   → suscrito {pendientes: [813, 814, ...], conectados: [...]}
```

Si falta más de una página, el servidor avisa con `HISTORIAL_INCOMPLETO` para
que el cliente recargue por REST en vez de creer que está al día.

---

## API REST

Todas las rutas de `/api/chats` exigen sesión (cookie `lum_session` o
`Authorization: Bearer`).

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/chats` | Crear grupo. `{ nombre, maxMiembros, eventoId? }` |
| `GET` | `/api/chats` | Mis grupos, con contador de no leídos |
| `GET` | `/api/chats/:id` | Detalle + miembros + quién está conectado |
| `POST` | `/api/chats/:id/miembros` | Unirse uno mismo. Mandar el id de otra persona da 403 |
| `DELETE` | `/api/chats/:id/miembros/:usuarioId` | Salir, o expulsar si sos admin |
| `POST` | `/api/chats/:id/invitaciones` | Invitar a alguien. `{ usuarioId }`. Cualquier miembro |
| `GET` | `/api/chats/:id/invitaciones` | Invitaciones pendientes del grupo |
| `GET` | `/api/invitaciones` | Mis invitaciones pendientes |
| `POST` | `/api/invitaciones/:id/aceptar` | Aceptar y entrar. Acá se comprueba el cupo |
| `POST` | `/api/invitaciones/:id/rechazar` | Rechazar |
| `DELETE` | `/api/invitaciones/:id` | Cancelar (quien invitó, o un admin) |
| `GET` | `/api/chats/:id/mensajes?antesDe=&limite=` | Historial paginado por keyset |
| `POST` | `/api/chats/:id/mensajes` | Enviar por HTTP (respaldo si el WS está caído) |
| `POST` | `/api/chats/:id/leido` | Avanzar el cursor de lectura |
| `GET` | `/salud` | Liveness — no toca dependencias |
| `GET` | `/salud/listo` | Readiness — 503 si PostgreSQL no responde |

La paginación usa cursor (`antesDe=<seq>`), no `OFFSET`: con mensajes llegando
mientras el usuario scrollea, el desplazamiento corre y se repiten o se saltan
filas.

Quien no pertenece al grupo recibe **404, no 403**, para no revelar que el
grupo existe.

---

## Protocolo WebSocket

Conexión: `ws://host:4002/ws` — se autentica en el handshake con la cookie de
sesión. No hace falta enviar el token en ningún marco.

**Cliente → servidor**

| `tipo` | Campos | |
|---|---|---|
| `suscribir` | `chatId`, `desdeSeq?` | Entra al chat; con `desdeSeq` pide lo que se perdió |
| `desuscribir` | `chatId` | |
| `mensaje` | `chatId`, `contenido`, `clientMsgId` | `clientMsgId` es un UUID v4 generado por el cliente |
| `leido` | `chatId`, `seq` | |
| `escribiendo` | `chatId` | Efímero, no se persiste |
| `ping` | | |

**Servidor → cliente**

`bienvenida` · `suscrito` · `desuscrito` · `mensaje` · `ack` · `presencia` ·
`escribiendo` · `miembro` · `invitacion` · `chat-eliminado` · `leido` · `pong` ·
`error`

El evento `miembro` lleva `accion`: `alta`, `baja` o `nuevo-admin`. Al recibir
`baja` con el propio `usuarioId`, o `chat-eliminado`, el servidor ya cortó la
suscripción — el cliente debe sacar el chat de su lista.

### Dos canales, no uno

El bus tiene dos destinos, y la diferencia no es cosmética:

| Destino | Llega a | Para qué |
|---|---|---|
| `chat` | los suscritos a ese chat | mensajes, presencia, altas y bajas |
| `usuario` | todas las conexiones de una persona | **invitaciones** |

Una invitación **no puede viajar por el canal del chat**: su destinatario
todavía no pertenece al grupo, así que no está suscrito a esa sala y nunca la
recibiría. Por eso existe el canal por usuario.

El evento `invitacion` lleva `accion`:

- `recibida` / `cancelada` → al invitado, por su canal personal
- `emitida` / `resuelta` → al grupo, para que la lista de pendientes que ven sus
  miembros se mantenga al día sin recargar

**Códigos de cierre**

| Código | Significado |
|---|---|
| `4401` | No autenticado |
| `4403` | Sin permiso |
| `4440` | La sesión expiró estando conectado |
| `4408` | Sin respuesta al latido |
| `4429` | Rate limit o demasiadas conexiones |
| `4413` | Marco demasiado grande |
| `4499` | Cliente lento (backpressure) |

El cliente debe reconectar con backoff exponencial ante `1006` y `4499`, pero
**no** ante `4401`/`4440`: ahí hay que renovar la sesión primero.

---

## Protecciones implementadas

| Riesgo | Mitigación |
|---|---|
| Sobrecupo por entradas simultáneas | `SELECT … FOR UPDATE` sobre el grupo |
| Mensajes duplicados por reintento | UUID de cliente + índice único |
| Huecos o desorden en el historial | `seq` por chat asignado bajo lock |
| Paginación que salta mensajes | Cursor keyset en vez de `OFFSET` |
| Conexiones zombis (móvil sin cobertura) | Ping/pong cada 30 s, `terminate()` al fallar |
| Cliente lento agota la memoria | Corte por `bufferedAmount` > 1 MB |
| Inundación de mensajes por WebSocket | Token bucket por conexión |
| Inundación esquivando el WS por REST | Token bucket por usuario en `/mensajes` y `/chats` |
| Marcos gigantes | `maxPayload` 16 KB en `ws` |
| **CSWSH** (secuestro entre orígenes) | Validación de `Origin` en el handshake |
| Sesión que caduca con el socket abierto | Temporizador que cierra con `4440` |
| Interbloqueos entre alta y mensaje | Orden de locks siempre `chat_grupos` primero |
| Consultas colgadas agotan el pool | `statement_timeout` + `enTransaccion` con `finally` |
| Caída de Redis tumba el chat | Toda operación de caché degrada a PostgreSQL |
| Fuga de memoria en el registro de salas | Se borran las claves vacías en `desuscribir` |

---

## Escalado horizontal

Cada réplica mantiene en memoria solo *sus* sockets. El alcance global lo da
Redis Pub/Sub.

```
        ┌── Instancia 1 ──┐
Cliente─┤   (sockets A,B) ├──┐
        └─────────────────┘  │
                             ├── Redis Pub/Sub (canal luminsieme:chat:eventos)
        ┌── Instancia 2 ──┐  │
Cliente─┤   (sockets C,D) ├──┘
        └─────────────────┘
```

No hace falta *sticky session* para la corrección: cualquier instancia puede
atender a cualquier usuario porque el estado compartido vive en PostgreSQL y
Redis. Sí conviene por eficiencia, para evitar reconexiones innecesarias.

---

## Reglas de acceso y ciclo de vida

**Los grupos son abiertos.** Cualquier usuario autenticado puede unirse a un
grupo con cupo conociendo su id (`POST /api/chats/:id/miembros`, sin cuerpo). No
hay grupos privados: encaja con eventos públicos de cine, donde el chat es el
punto de encuentro y no un espacio cerrado.

**Nadie entra sin consentimiento.** Que los grupos sean abiertos no significa
que a alguien se lo pueda meter adentro. `POST /:id/miembros` solo da de alta a
quien hace la petición; mandar el `usuarioId` de otra persona devuelve **403**.
Para avisar a alguien existen las invitaciones, y solo el destinatario puede
convertirlas en membresía. Esto cumple con lo que pide `AGENTES.md` sobre no
forzar emparejamientos sin consentimiento explícito.

**Cualquier miembro puede invitar**, no solo los administradores: el chat es
una herramienta de coordinación entre pares. La invitación no reserva cupo —el
cupo se comprueba al aceptar, porque entre una cosa y otra el grupo puede
llenarse o vaciarse— y caduca a los 7 días.

**Si se va el último administrador, se asciende al azar a otro miembro.** El
ascenso ocurre bajo el mismo lock que la baja, así que dos salidas simultáneas
no pueden dejar el grupo con dos admins ni con ninguno.

**Si se va el último miembro, el grupo se elimina por completo** — mensajes,
membresías e invitaciones, por `ON DELETE CASCADE`, más la limpieza de su caché
en Redis. Sin nadie que pueda volver a abrir la conversación, conservarla solo
ocupa espacio.

> **Ojo con la distinción.** Esto es que *todos se dieron de baja del grupo*, no
> que se hayan cerrado las sesiones. Al desconectarse —o al cerrar sesión todos
> los participantes— los mensajes se conservan intactos, que es el requisito
> original del módulo. Solo el abandono explícito de la última persona borra.

**`evento_id` se valida contra el `reunion-controller`** antes de crear el chat.
Si ese servicio está configurado pero no responde, la creación de chats *con
evento* falla con **503** en vez de dejar pasar referencias inválidas. Es un
acoplamiento acotado a un endpoint poco frecuente: enviar, leer y unirse no
dependen de él. Con `REUNION_SERVICE_URL` vacía la validación se omite y queda
registrado en el log, para poder desarrollar antes de que ese módulo exista.

---

## Limitaciones conocidas

1. **El contador de no leídos incluye mensajes eliminados.** Es
   `ultimo_seq - ultimo_leido_seq`, aritmética en tiempo constante. Cambiar a un
   `COUNT` exacto sería correcto pero más caro; con borrados poco frecuentes la
   desviación es despreciable.

2. **La presencia parpadea con el mismo usuario en dos instancias.** La entrada
   en Redis está indexada por `usuario_id`; si una instancia lo marca ausente, la
   otra lo repone en el siguiente latido (≤30 s). Indexar por
   `usuario_id:instancia` lo resolvería del todo.

3. **`escribiendo` no tiene rate limit propio**, solo el token bucket general de
   la conexión. Un cliente mal implementado puede gastar sus tokens ahí.

4. **Fuera del alcance del MVP:** borrar y editar mensajes, adjuntos, y archivar
   grupos. La columna `chat_mensajes.eliminado_en` queda en el esquema como
   punto de enganche para el borrado lógico, pero nada la escribe todavía.

5. **`POST /:id/leido` no valida el `seq` contra el último del chat.** Un
   cliente puede enviar un número arbitrariamente alto y poner su contador de no
   leídos en cero. Solo se afecta a sí mismo, pero convendría acotarlo con
   `LEAST(seq, ultimo_seq)`.

6. **El rate limit es por instancia, no global.** Tanto el token bucket del
   WebSocket (por conexión) como el de REST (por usuario, en memoria) se
   multiplican por el número de réplicas y por las conexiones abiertas. Es un
   techo aproximado, deliberado: un limitador exacto en Redis metería una
   dependencia dura en el camino de escritura.

7. **Redis transporta el contenido de los mensajes en claro** por el canal
   Pub/Sub. Dado el requisito de confidencialidad, Redis debe quedar en red
   privada y con `requirepass`; no exponerlo nunca a internet.

8. **`setTypeParser(20, Number)` es una mutación global de `pg`.** Convierte
   todos los BIGINT del proceso a `Number`, que pierde precisión más allá de
   2^53. Es seguro para los ids de este servicio, pero hay que tenerlo presente
   si el módulo se fusiona con otro que maneje bigints reales.

---

## Pruebas

```bash
npm run prueba              # 68 casos, sin dependencias externas
npm run prueba:integracion  # 28 casos, requiere PostgreSQL
npm run prueba:estres       # 13 casos de concurrencia, requiere PostgreSQL
```

Para los dos últimos hace falta PostgreSQL. Con Docker:

```bash
docker compose up -d && npm run migrar
```

Sin Docker, usando el PostgreSQL 16 ya instalado en Windows (así se validaron
estas pruebas), en una instancia temporal que no toca la del sistema:

```bash
BIN="/c/Program Files/PostgreSQL/16/bin"
DATA="$TEMP/pg-luminsieme"

"$BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C
"$BIN/pg_ctl" -D "$DATA" -l "$DATA/pg.log" -o "-p 55432 -c listen_addresses=127.0.0.1" start
"$BIN/createdb" -h 127.0.0.1 -p 55432 -U postgres luminsieme_test

export DATABASE_URL="postgres://postgres@127.0.0.1:55432/luminsieme_test"
export JWT_SECRET="cualquier-cosa-para-pruebas"
npm run migrar && npm run prueba:integracion && npm run prueba:estres

"$BIN/pg_ctl" -D "$DATA" stop        # al terminar
```

Redis no hace falta para las pruebas: al no estar disponible, el servicio cae al
camino degradado contra PostgreSQL, que es justamente lo que estas pruebas
también ejercitan.

**Estado: 109/109 pasan** contra PostgreSQL 16.14.

`prueba-humo.js` — carga de módulos, validadores, protocolo WebSocket,
verificación de JWT (incluido el rechazo de `alg:none`), registro de salas,
enrutado de eventos por los dos canales del bus, y cableado HTTP.

`prueba-integracion.js` — cupo con altas simultáneas, idempotencia de
reintentos, `seq` sin huecos, paginación keyset, expulsión, reingreso, cursor de
lectura, persistencia, traspaso de admin, borrado del grupo vacío, el flujo
completo de invitaciones, la purga (incluido que libere el índice único y
respete la retención), las migraciones (idempotencia y detección de archivos
editados) y la validación de eventos contra un `reunion-controller` simulado
(existe / no existe / caído / sin configurar).

`prueba-estres.js` — fuerza las carreras que el diseño dice resolver:

| Caso | Resultado medido |
|---|---|
| Cupo bajo carrera, 20 rondas seguidas | 20/20 sin sobrecupo |
| 200 mensajes concurrentes | `seq` correlativa, ~450 msg/s |
| Altas + bajas + mensajes simultáneos | 134 operaciones, 0 interbloqueos |
| 100 transacciones fallidas seguidas | pool 10/10 ociosas, 0 en espera |
| 5 chats a la vez para el mismo evento | 1 gana, 4 rechazados con `CONFLICTO` |
| Salir y escribir a la vez, 15 rondas | 15/15 coherentes |
| Invitaciones simultáneas a la misma persona, 10 rondas | 10/10 con una sola pendiente |
| 10 aceptaciones en masa sobre 3 lugares libres | 3 entran, 7 con `CUPO_LLENO` |
| Salidas simultáneas incluyendo al admin, 15 rondas | 15/15 con **exactamente** un admin |
| Vaciar el grupo bajo carrera, 10 rondas | 10/10 sin filas huérfanas |
| Invitar y vaciar el grupo a la vez, 10 rondas | 10/10 sin invitaciones colgadas |
| Restricciones `CHECK` de la base | longitud y coherencia de autor activas |

La prueba de las 100 transacciones fallidas es la que respalda que
`enTransaccion` devuelve el cliente al pool en el camino de error: sin ese
`finally`, el pool (máximo 10) se agotaría y el servicio quedaría colgado para
siempre tras unos pocos errores.
