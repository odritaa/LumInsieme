# LumInsieme
## Descripcion del proyecto
> Es una plataforma web que busca conectar aficionados al cine de todo el pais por medio de un sistema que empareja a los diferentes usuarios con sus gustos y forma vinculos con el objetivo de compartir salidas al cine
## Estructura del proyecto
```
.
├── .gitignore
├── README.md
├── AGENTES.md
├── docker-compose.yml
├── docs/
└── src/
    ├── frontend/            # React + Tailwind (nginx en Docker)
    ├── login-controller/    # Google OAuth + JWT (NodeJS, :4000)
    ├── reunion-controller/  # Salas, feed y cartelera (NodeJS, :4100)
    ├── chat-controller/     # Chat por sala en tiempo real (WebSockets, :3000)
    ├── cache-controller/    # Acceso a Redis por gRPC (Golang, :50051)
    └── scrapper/            # Cartelera de cines (Python + Playwright, on-demand)
```
## Guia de uso

Todos los comandos se ejecutan desde la **raiz del repositorio**, salvo que se indique otra carpeta.

### 1. Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y **abierto** (el motor tiene que estar corriendo).
- [Node.js 22](https://nodejs.org/) o superior, para el frontend en modo desarrollo.
- Credenciales de Google OAuth (Client ID y Client Secret). Como obtenerlas: ver [src/login-controller/README.md](src/login-controller/README.md#credenciales-de-google).

No hace falta instalar PostgreSQL, Redis, Go ni Python: corren dentro de Docker.

### 2. Instalacion (solo la primera vez)

**2.1. Generar un secreto para las sesiones (JWT)**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guardar el valor: se usa en los dos archivos de configuracion siguientes y tiene que ser **identico** en ambos.

**2.2. Configuracion general** — copiar `.env.example` a `.env` y completar:

| Variable | Valor |
|---|---|
| `POSTGRES_PASSWORD` | Cualquier contraseña para la base local |
| `JWT_SECRET` | El secreto generado en 2.1 |
| `FRONTEND_URL` | `http://localhost:5173` |
| `CACHE_TTL` | Segundos que dura la cartelera en cache (recomendado `86400`) |

**2.3. Configuracion del login** — copiar `src/login-controller/.env.example` a `src/login-controller/.env` y completar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `JWT_SECRET` (el mismo de 2.1). `DATABASE_URL` no hace falta tocarla: Docker Compose la reemplaza.

**2.4. Dependencias del frontend**

```bash
cd src/frontend
npm install
```

### 3. Iniciar la app

**3.1. Levantar el backend** (la primera vez tarda unos minutos porque construye las imagenes):

```bash
docker compose up -d --build postgres redis cache-controller login-controller reunion-controller chat-controller
```

**3.2. Verificar que este todo en pie** — todos los servicios deben figurar como `healthy` (o `Up` en el caso del login):

```bash
docker compose ps
```

**3.3. Cargar la cartelera** — el scrapper no corre solo: se ejecuta, guarda la cartelera de los proximos dias y termina. Repetirlo cuando la cartelera vence (ver `CACHE_TTL`) o para actualizarla:

```bash
docker compose --profile scrapper run --rm scrapper
```

**3.4. Levantar el frontend**

```bash
cd src/frontend
npm run dev
```

Abrir **http://localhost:5173** e iniciar sesion con Google. Vite reenvia `/auth`, `/cartelera`, `/salas` y `/ws` a los servicios de Docker.

> **Alternativa sin Node:** `docker compose up -d --build frontend` sirve la app compilada con nginx en **https://localhost:8443** (el certificado es autofirmado: el navegador muestra una advertencia que hay que aceptar). Para iniciar sesion por esta via, el redirect de Google y `FRONTEND_URL` deben apuntar a esa direccion.

### 4. Detener la app

**4.1. Frontend:** en la terminal donde corre `npm run dev`, presionar `Ctrl + C`.

**4.2. Backend:** elegir una de estas opciones. Ninguna borra datos.

| Comando | Que hace | Cuando usarlo |
|---|---|---|
| `docker compose stop` | Apaga los contenedores pero los deja creados | Pausa del dia a dia; se retoma con `docker compose start` |
| `docker compose down` | Apaga y elimina contenedores y red | Para dejar todo limpio; se retoma con el paso 3.1 |

Usuarios, salas y mensajes del chat **se conservan** en ambos casos: viven en los volumenes `luminsieme_pgdata` (PostgreSQL) y `luminsieme_redisdata` (Redis). Los mensajes del chat igualmente vencen a los 3 dias sin actividad en la sala, y la cartelera segun `CACHE_TTL`.

> ⚠️ **`docker compose down -v` borra los volumenes**, es decir, **todos los usuarios, salas y chats**. Usarlo solo para empezar de cero a proposito.

### 5. Comandos utiles

| Para… | Comando |
|---|---|
| Retomar el backend despues de `stop` | `docker compose start` |
| Ver los logs de un servicio | `docker compose logs -f reunion-controller` |
| Aplicar cambios de codigo de un servicio | `docker compose up -d --build chat-controller` |
| Revisar la salud de los servicios | `curl localhost:4000/health`, `curl localhost:4100/health`, `curl localhost:3000/health` |
| Quitar contenedores de versiones anteriores del compose | `docker compose down --remove-orphans` |

### 6. Problemas frecuentes

- **`error during connect` / `cannot find the file specified`**: Docker Desktop no esta abierto. Abrirlo, esperar a que diga *Engine running* y repetir el comando.
- **`definir POSTGRES_PASSWORD` o `definir JWT_SECRET`**: falta esa variable en el `.env` de la raiz (paso 2.2).
- **El feed dice "La cartelera todavia no esta disponible"**: vencio la cartelera en cache; correr el paso 3.3.
- **Al iniciar sesion vuelve al login o falla el chat**: el `JWT_SECRET` de `.env` y el de `src/login-controller/.env` no coinciden.
- **`port is already allocated`**: otro programa usa ese puerto (5432, 4000, 4100, 3000 o 50051). Cerrarlo o detener el contenedor que lo ocupa.
