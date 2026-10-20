# reunion-controller

Salas (eventos) de LumInsieme, su feed cronológico y la cartelera scrapeada.

- **Salas**: PostgreSQL (misma base que `login-controller`; `salas.host_id` y `sala_miembros.user_id` referencian `users`).
- **Cartelera**: lee la clave `scraped_data` del `cache-controller` por gRPC. Nunca habla con Redis ni con el scrapper.
- **Chat**: emite *tickets* firmados para que `chat-controller` sepa quién es el usuario y a qué sala pertenece, sin consultar Postgres.

## Cómo levantarlo

```bash
# Con Docker (recomendado), desde la raíz del repo
docker compose up -d postgres redis cache-controller login-controller reunion-controller chat-controller

# Local
cp .env.example .env      # JWT_SECRET debe ser el mismo que el de login-controller
npm install
npm run dev
```

El esquema (`db/init/*.sql`) se aplica solo al arrancar y queda registrado en `reunion_migrations`. Como las salas referencian `users`, si esa tabla todavía no existe el servicio reintenta durante ~1 minuto. `npm run db:migrate` hace lo mismo a mano.

## Endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| `GET` | `/health` | — | `{"status","db","cache"}`. Sin cache queda `degraded` (200); sin DB, `503` |
| `GET` | `/cartelera?fecha=AAAA-MM-DD` | — | `{ dates, date, screenings }`: días disponibles y funciones del día ordenadas por hora. Sin `fecha` elige hoy o el próximo día con funciones |
| `GET` | `/cartelera/peliculas` | — | `{ movies }`: catálogo plano (película, cine, día) para el buscador de Crear Sala |
| `GET` | `/salas` | JWT | Feed de salas vigentes, igual para todos, de la más reciente a la más antigua |
| `POST` | `/salas` | JWT | Crea una sala; el creador queda como miembro y anfitrión |
| `GET` | `/salas/:id` | JWT | Detalle de una sala |
| `POST` | `/salas/:id/miembros` | JWT | Unirse (idempotente). `409 sala_full` / `409 sala_closed` |
| `DELETE` | `/salas/:id/miembros/me` | JWT | Salir. Si sale el anfitrión, pasa al miembro más antiguo; si no queda nadie, la sala se elimina y responde `{ "sala": null }` |
| `POST` | `/salas/:id/chat-ticket` | JWT | `{ ticket }` para conectarse al chat. Solo miembros (`403 not_a_member`) |

`JWT` = cookie `lum_session` emitida por `login-controller` o `Authorization: Bearer`.

## Decisiones

- **Feed sin personalización**: orden único por `created_at DESC`, como fija la resolución del 28/09/2026. Se ocultan las salas cuya fecha ya pasó (zona `TIMEZONE`).
- **Cupo sin carreras**: el alta bloquea la fila de la sala (`SELECT … FOR UPDATE`), así dos usuarios no pueden ocupar el último lugar a la vez.
- **Privacidad**: de cada miembro solo salen `id`, `name` y `genres`; email, edad y ciudad no.
- **Ticket de chat**: JWT HS256 con `aud=luminsieme-chat`, `sala` y 5 minutos de vida. El chat lo valida con el `JWT_SECRET` compartido, sin acoplarse a este servicio ni a Postgres. La membresía se verifica al conectar; el frontend cierra el socket al salir de la sala.
- **Formato de `scraped_data`**: acepta el formato actual del scrapper (`[{ "AAAA-M-D": [película] }]`) y el anterior (lista plana con fecha ISO). Las funciones duplicadas se listan una vez.
