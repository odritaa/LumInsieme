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

### 7. Pruebas

El plan de pruebas del TP4 y los resultados de su ejecucion estan en [docs/testing/](docs/testing/) ([resultados](docs/testing/resultados-2026-10-21.md), [defectos](docs/testing/defectos.md)). Cada prueba lleva un ID `PT-CU0X-NN` (caso de uso) o `PT-TR-NN` (transversal) al inicio del titulo.

Los comandos estan escritos para **Git Bash**. En Git Bash, los que usan `docker run -v` necesitan `MSYS_NO_PATHCONV=1` delante. En PowerShell, reemplazar `$(pwd)` por `${PWD}`.

**7.1. Stack de pruebas** (aislado del de desarrollo: proyecto `luminsieme-test`, datos en memoria y secretos generados en `tests/stack/test.env`):

| Para… | Comando |
|---|---|
| Solo Postgres (lo usan las suites de login y reunion, puerto 55432) | `node tests/stack/stack.mjs up postgres` |
| Stack completo en `https://localhost:8443` (E2E, k6, ZAP) | `node tests/stack/stack.mjs up` |
| Sembrar usuarios, salas, cartelera y tokens de prueba | `node tests/stack/stack.mjs seed` |
| Bajar el stack y borrar sus datos | `node tests/stack/stack.mjs down` |

> El stack completo publica el puerto 8443, igual que el `frontend` de desarrollo: no levantar los dos a la vez.

**7.2. Unitarias e integracion**

| Modulo | Herramienta | Comando (desde la carpeta del modulo) |
|---|---|---|
| `src/login-controller` | Vitest + Supertest | `npm install`, `npm test` · cobertura: `npm run test:coverage` |
| `src/reunion-controller` | Vitest + Supertest | `npm install`, `npm test` · cobertura: `npm run test:coverage` |
| `src/chat-controller` | Vitest + Supertest | `npm install`, `npm test` · cobertura: `npm run test:coverage` |
| `src/frontend` | Vitest + React Testing Library | `npm install`, `npm test` · cobertura: `npm run test:coverage` |
| `src/cache-controller` | go test + Testify + miniredis | `go test -cover .` · sin Go instalado: `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/src" -w /src golang:1.25 go test -cover .` |
| `src/scrapper` | pytest | ver abajo |

login y reunion necesitan antes el Postgres del stack (7.1); chat y frontend no.

Scrapper (Python 3.11 o superior):

```bash
cd src/scrapper
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt    # en Linux/macOS: .venv/bin/python
.venv/Scripts/python -m playwright install chromium
.venv/Scripts/python -m pytest --cov=.
```

**7.3. End-to-end (Playwright, viewport mobile en Chromium y WebKit)** — con el stack completo levantado y sembrado:

```bash
cd tests/e2e
npm install
npx playwright install chromium webkit
npm test                 # reporte: npm run report
```

**7.4. Carga (k6)** — desde la raiz, con el stack completo levantado y sembrado:

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/tests:/tests" -w /tests/load \
  -e K6_WEB_DASHBOARD=true -e K6_WEB_DASHBOARD_EXPORT=/tests/load/k6-http-report.html \
  grafana/k6:1.3.0 run http.js              # GET /cartelera y /salas, 50 VUs (VUS=200 para estres: -e VUS=200)
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/tests:/tests" -w /tests/load grafana/k6:1.3.0 run chat-ws.js            # chat, 60 usuarios
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/tests:/tests" -w /tests/load grafana/k6:1.3.0 run chat-ticket-burst.js  # rafagas de tickets
```

Los umbrales (p95 < 200 ms, error < 1 %) estan definidos en cada script; k6 termina con codigo distinto de 0 si alguno no se cumple.

**7.5. Seguridad (OWASP ZAP baseline)** — contra el frontend en `https://localhost:8443`, que desde el contenedor se alcanza como `host.docker.internal`:

```bash
TOKEN=$(node -e 'console.log(require("./tests/stack/fixtures.local.json").users[0].token)')
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/docs/testing/reportes/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://host.docker.internal:8443 -j -m 2 -r zap-baseline.html -J zap-baseline.json \
  -z "-config replacer.full_list(0).description=sesion -config replacer.full_list(0).enabled=true -config replacer.full_list(0).matchtype=REQ_HEADER -config replacer.full_list(0).matchstr=Cookie -config replacer.full_list(0).regex=false -config replacer.full_list(0).replacement=lum_session=$TOKEN"
```

La variable `TOKEN` agrega la cookie de sesion de un usuario de prueba, para que el spider tambien recorra las rutas autenticadas.

**7.6. Informe:** `node tests/report/collect.mjs` consolida los resultados crudos de `docs/testing/reportes/raw/` en la tabla del informe.
