# Dockerización e integración del scrapper y chat-controller con el cache-controller

| Campo | Detalle |
| :--- | :--- |
| **Fecha** | 19 de octubre de 2026 |
| **Módulos** | `src/scrapper/`, `src/chat-controller/`, `src/cache-controller/` |
| **Tema** | Creación de Dockerfiles, integración vía Docker Compose, ejecución on-demand del scrapper y verificación end-to-end con Redis |
| **Stack involucrado** | Python 3.11 + Playwright, Node.js 22 + Express + ws, Go 1.25 + gRPC, Redis 7, Docker Compose |
| **Rama de trabajo** | `cache-chat` |

---

## Objetivos

1. Crear un Dockerfile propio para cada módulo involucrado (`scrapper`, `chat-controller` y `cache-controller`).
2. Integrar los tres servicios junto con Redis dentro de `docker-compose.yml`.
3. Mantener la regla de arquitectura: `scrapper` y `chat-controller` **no se comunican entre sí**; ambos acceden únicamente al `cache-controller`, que centraliza el acceso a Redis.
4. Ejecutar el `scrapper` como servicio **one-shot bajo demanda**: se levanta cuando se necesita, scrapea una vez y termina.
5. Levantar los contenedores y verificar el funcionamiento real del chat, el scrapper y la persistencia en caché.

---

## Estado inicial

### `docker-compose.yml`
- Solo definía `postgres` y `login-controller`.
- No existían servicios para Redis, cache-controller, chat-controller ni scrapper.
- Exigía `POSTGRES_PASSWORD` desde un `.env` raíz que no existía.

### `src/cache-controller/`
- Servidor gRPC en `:50051` con acceso a Redis.
- Sin Dockerfile.
- `main.go` tenía hardcodeado `localhost:6379` y el puerto `:50051`.

### `src/scrapper/`
- Dockerfile desactualizado: instalaba un Redis local y arrancaba `uvicorn main:app`.
- `main.py` ya no era una app FastAPI: es un script one-shot que scrapea y envía el JSON al cache-controller por gRPC.
- `entrypoint.sh` seguía levantando `redis-server` y `uvicorn`.

### `src/chat-controller/`
- Servidor Express + WebSocket en el puerto `3000`.
- Sin Dockerfile.
- `cache-client.js` carga el proto desde `../../cache-controller/proto/cache.proto`, por lo que el contexto de build debía contemplar esa ruta.

---

## Trabajo realizado

### 1. `cache-controller` (Go)

#### `main.go`
Se reemplazaron los valores hardcodeados por variables de entorno con valores por defecto para ejecución local:

- `REDIS_ADDR` → por defecto `localhost:6379`
- `REDIS_PASSWORD` → por defecto vacío
- `GRPC_PORT` → por defecto `50051`

Esto permite que en Compose use `redis:6379` sin romper la ejecución local.

#### `Dockerfile` (nuevo)
Build multi-stage:

- Etapa builder: `golang:1.25-alpine`, descarga dependencias y compila con `CGO_ENABLED=0`.
- Etapa runtime: `alpine:3.21` con `ca-certificates` y `netcat-openbsd` para el healthcheck.
- Expone `50051` y define `REDIS_ADDR=redis:6379`, `GRPC_PORT=50051`.

#### `.dockerignore` (nuevo)
Excluye binarios locales (`cache-controller`, `testclient`), el directorio `github.com/` y `.git/`.

### 2. `scrapper` (Python/Playwright)

#### `Dockerfile`
- Base `python:3.11-slim`.
- Instala dependencias de `requirements.txt`.
- Ejecuta `playwright install --with-deps chromium`, que instala Chromium y todas las librerías del sistema necesarias.
- Elimina por completo Redis local y cualquier referencia a `uvicorn`.
- Ejecuta el `entrypoint.sh`.

#### `entrypoint.sh`
Ahora ejecuta el flujo one-shot:

```sh
#!/bin/sh
set -e

exec python main.py
```

#### `.dockerignore`
Se agregó `.env` para no incluir configuración local dentro de la imagen. Las variables se inyectan desde Compose.

### 3. `chat-controller` (Node.js)

#### `Dockerfile` (nuevo)
- Base `node:22-alpine`.
- `npm ci --omit=dev` para instalar solo dependencias de producción.
- Copia `src/` y el proto de cache-controller en la ruta relativa esperada:
  `/app/src/cache-controller/proto/cache.proto`.
- Variables por defecto: `PORT=3000`, `CACHE_GRPC_ADDR=cache-controller:50051`.
- Expone el puerto `3000`.

> El contexto de build es `./src` (no `./src/chat-controller`) para poder copiar el proto compartido sin modificar el código del cliente gRPC.

### 4. `docker-compose.yml`

Se agregaron cuatro servicios:

- `redis`: `redis:7-alpine`, volumen `redisdata` y healthcheck con `redis-cli ping`.
- `cache-controller`: build desde `./src/cache-controller`, conectado a `redis`, puerto `50051`, healthcheck TCP.
- `chat-controller`: build con contexto `./src`, puerto `3000`, depende de `cache-controller` saludable.
- `scrapper`: build desde `./src/scrapper`, con `profiles: ["scrapper"]` para ejecutarse solo on-demand, `restart: "no"` y variables:
  - `GRPC_HOST=cache-controller`
  - `GRPC_PORT=50051`
  - `CACHE_TTL`
  - `SCRAPPING_DAYS`

Todos los servicios comparten la red interna de Compose y se resuelven por nombre de servicio.

### 5. `.env` raíz

Se creó un `.env` local (ignorado por git) con:

```env
POSTGRES_USER=luminsieme
POSTGRES_PASSWORD=luminsieme_dev_local
POSTGRES_DB=luminsieme
CACHE_TTL=3600
SCRAPPING_DAYS=5
```

Necesario porque `docker-compose.yml` exige `POSTGRES_PASSWORD` durante la interpolación de variables.

---

## Arquitectura resultante

```
                    ┌────────────────────┐
                    │     Redis :6379    │
                    └─────────▲──────────┘
                              │
                    ┌─────────┴──────────┐
                    │ cache-controller   │
                    │ gRPC :50051        │
                    └──────▲──────▲──────┘
                           │      │
              ┌────────────┘      └────────────┐
              │                                │
    ┌─────────┴────────┐              ┌────────┴─────────┐
    │ chat-controller  │              │ scrapper         │
    │ HTTP/WS :3000    │              │ one-shot         │
    └──────────────────┘              └──────────────────┘
```

- `chat-controller` y `scrapper` solo hablan con `cache-controller`.
- Ninguno de los dos se conecta directamente a Redis.
- `scrapper` tampoco habla con `chat-controller`.

---

## Cómo levantar los contenedores

### Requisitos previos

- Docker y Docker Compose instalados.
- Archivo `.env` en la raíz del repositorio con `POSTGRES_PASSWORD` (y opcionalmente `CACHE_TTL` y `SCRAPPING_DAYS`).

### Construir las imágenes

```bash
docker compose build cache-controller chat-controller scrapper
```

### Levantar los servicios permanentes

```bash
docker compose up -d redis cache-controller chat-controller
```

Esto deja disponibles:

- Chat HTTP/WebSocket: `http://localhost:3000`
- Cache-controller gRPC: `localhost:50051`
- Redis: solo accesible dentro de la red de Compose

### Verificar el estado

```bash
docker compose ps
curl http://localhost:3000/health
docker compose logs -f chat-controller
docker compose logs -f cache-controller
```

### Ejecutar el scrapper on-demand

El scrapper **no forma parte del arranque por defecto** gracias al perfil `scrapper`. Se ejecuta cuando se necesita y se elimina al terminar:

```bash
docker compose --profile scrapper run --rm scrapper
```

Flujo esperado:

1. Compose comprueba que `cache-controller` esté saludable.
2. Se inicia un contenedor temporal del scrapper.
3. Playwright scrapea Multiplex.
4. El JSON se envía por gRPC con `SetWithTTL` a la clave `scraped_data`.
5. El proceso termina con código `0` y el contenedor se elimina gracias a `--rm`.

### Detener los servicios

```bash
docker compose stop redis cache-controller chat-controller
```

Para eliminar contenedores y red:

```bash
docker compose down
```

Para eliminar también los volúmenes (incluye datos de Redis):

```bash
docker compose down -v
```

> Para levantar `postgres` y `login-controller` es necesario crear `src/login-controller/.env` con las credenciales de Google OAuth y JWT. Esos servicios no forman parte de esta integración y no se levantaron en la verificación.

---

## Verificación realizada

### Construcción
- `docker compose build cache-controller chat-controller scrapper` → exitoso.

### Servicios permanentes
- `luminsieme-redis` → `healthy`
- `luminsieme-cache` → `healthy`
- `luminsieme-chat` → `healthy`

### Cache-controller
Logs:

```text
Conectado a Redis correctamente
Servidor gRPC escuchando en :50051
```

### Chat-controller
- `GET http://localhost:3000/health` → `{"status":"ok","cache":"ok"}`
- Se abrió una conexión WebSocket con `event_id=test-event`.
- Se envió un mensaje y se recibió el broadcast correctamente.
- Tras el flush por batch, el mensaje quedó persistido en Redis:

```text
LLEN chat:test-event → 1
TTL chat:test-event  → ≈ 259196 s (3 días)
```

La clave de prueba se eliminó al finalizar.

### Scrapper
Ejecución:

```bash
docker compose --profile scrapper run --rm scrapper
```

Salida:

```text
[INFO] Scraping completado. Datos cacheados en 'scraped_data' con TTL de 3600s.
```

Verificación en Redis:

```text
STRLEN scraped_data → 25350 bytes
TTL scraped_data    → ≈ 3596 s
```

El contenido almacenado corresponde a un JSON con fechas, películas, funciones y complejos de Multiplex.

---

## Decisiones técnicas

1. **Scrapper one-shot bajo demanda:** se usa un perfil de Compose para que no arranque con `docker compose up` y se ejecute explícitamente con `run --rm`.
2. **Cache-controller como único acceso a Redis:** scrapper y chat no conocen Redis; toda operación pasa por gRPC.
3. **Nombres de servicio como hostnames:** `redis` y `cache-controller` se resuelven por DNS interno de Compose.
4. **Contexto de build `./src` para chat:** permite conservar la ruta relativa del proto sin duplicar el contrato ni modificar `cache-client.js`.
5. **Healthchecks:** Redis, cache-controller y chat-controller condicionan el arranque de sus dependientes.
6. **Variables de entorno:** `main.go` mantiene defaults locales, por lo que el mismo binario sirve para ejecución local y para Compose.
7. **Playwright con `--with-deps`:** garantiza que Chromium funcione dentro de la imagen sin instalar librerías manualmente una por una.

---

## Archivos creados / modificados

| Archivo | Acción | Descripción |
| :--- | :--- | :--- |
| `docker-compose.yml` | Modificado | Servicios `redis`, `cache-controller`, `chat-controller` y `scrapper` con perfil on-demand |
| `src/cache-controller/Dockerfile` | **Nuevo** | Build multi-stage en Go 1.25 |
| `src/cache-controller/.dockerignore` | **Nuevo** | Excluye binarios locales y `.git` |
| `src/cache-controller/main.go` | Modificado | Configuración de Redis, password y puerto gRPC por variables de entorno |
| `src/chat-controller/Dockerfile` | **Nuevo** | Imagen Node 22 con proto compartido y cliente gRPC |
| `src/scrapper/Dockerfile` | Modificado | Python 3.11 + Playwright, sin Redis local ni uvicorn |
| `src/scrapper/entrypoint.sh` | Modificado | Ejecuta `python main.py` una sola vez |
| `src/scrapper/.dockerignore` | Modificado | Excluye `.env` del contexto de build |
| `.env` (raíz) | **Nuevo** (ignorado por git) | Variables para Compose y parámetros del scrapper |

---

## Próximos pasos

1. **Autenticación gRPC:** agregar API keys o JWT entre módulos y cache-controller.
2. **Monitoreo:** exponer métricas de latencia, throughput y errores para Grafana/Prometheus.
3. **Scrapper programado:** si se requiere actualización periódica, agregar un scheduler externo (cron, systemd timer o job de CI) que ejecute `docker compose --profile scrapper run --rm scrapper`.
4. **Completar stack:** crear `src/login-controller/.env` con credenciales OAuth/JWT para poder levantar también `postgres` y `login-controller`.
5. **Tests automatizados:** suite end-to-end que valide healthchecks, WebSocket, persistencia del chat y ejecución del scrapper.
