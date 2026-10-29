# Datos de calidad y gestión de la configuración — LumInsieme (TP6 a TP9)

| | |
|---|---|
| **Fecha de relevamiento** | 27/10/2026 (zona horaria America/Argentina/Buenos_Aires) |
| **Repositorio** | `github.com/odritaa/LumInsieme` (público) |
| **Snapshot de refs** | `origin/main` = `bceec38` (26/10/2026); `tp4-plan-pruebas` = `caf5d66` (21/10/2026, solo local). Fetch hecho el 27/10 |
| **Entorno** | Windows 11 Home 10.0.26300; Intel Core i7-8750H, 15,9 GB RAM; Docker Desktop 29.6.2; Node 22.13.1 / npm 11.3.0; Python 3.13.3; Go 1.25.14 (contenedor `golang:1.25`) |
| **Herramientas** | git 2.46.2, API REST de GitHub (sin autenticación), gitleaks 8.28.0, oxlint 1.74.0, go vet, staticcheck 2025.1.1, govulncheck 1.1.4, ruff 0.14.1, npm audit (npm 11.3.0), pip-audit 2.9.0, Vitest 5.0.5, pytest 8.4.2, go test, Playwright 1.64.1 (Chromium 156.0.8078.4, WebKit 27.2), k6 1.3.0, OWASP ZAP 2.17.0 |

## 0. Cómo se obtuvieron los datos

- **Nada se corrigió.** Durante este relevamiento no se modificó código ni configuración del repositorio y no se hizo ningún commit. Lo único nuevo son los archivos de `docs/calidad/` (sin commitear). Había dos cambios locales previos sin commitear y no se tocaron: espacios agregados al título de `docs/testing/resultados-2026-10-21.md`, y `src/login-controller/node_modules/.package-lock.json`. Efecto lateral corregido: la corrida E2E de control (sobre `tp4-plan-pruebas`) sobrescribió las 10 capturas de `docs/testing/capturas/`, porque la suite guarda ahí sus capturas. Se restauraron a la versión commiteada con `git checkout -- docs/testing/capturas/`; no quedan diferencias.
- **Por qué `main` necesitó pruebas superpuestas.** `main` no contiene las suites del TP4: la rama `tp4-plan-pruebas` no está integrada ni subida (ver A5). Para correrlas sobre el código actual de `main` se armó un `git worktree` temporal de `origin/main` (`bceec38`) y se le copiaron **solo los archivos de prueba** del TP4: `tests/`, `src/*/test/`, configs de Vitest y pytest, `server_test.go`, y `package.json`/`go.mod` con las dependencias de prueba. Los únicos cambios de código de producción incluidos son los 2 de testabilidad de `chat-controller/src/server.js` (exportar `server` y admitir `PORT=0`). **No se incluyeron las correcciones DEF-01 a DEF-04**, así que las pruebas miden el comportamiento real de `main`.
- **Alcance de cada análisis.** El análisis estático corre sobre el código de `main` sin las pruebas superpuestas. `npm audit` y `pip-audit` usan los lockfiles y el `requirements.txt` tal como están en `origin/main`. gitleaks recorre la historia de todas las refs.
- **`gh` reemplazado por la API REST.** `gh` no está instalado y su login requiere una sesión interactiva. Como el repositorio es público, los mismos campos se tomaron de la API REST de GitHub (`/pulls`, `/pulls/{n}`, `/pulls/{n}/reviews`, `/branches`, `/issues`, `/actions/workflows`, `/rulesets`). `reviewDecision` solo existe en GraphQL autenticado y queda como n/d. El detalle de la protección de rama (`/branches/main/protection`) devuelve 401 sin autenticación; se usa el campo `protected` del endpoint público. Respuestas crudas en [`raw/gh-*.json`](raw/) y [`raw/pr-list.json`](raw/pr-list.json).
- **Mediciones de rendimiento descartadas.** La primera tanda de k6 y de carga inicial sobre `main` se tomó con la notebook **a batería** (Win32_Battery.BatteryStatus = 1, 40 %). Dio tiempos entre 4 y 8 veces peores. El control con el código del 21/10 ya se tomó con el equipo enchufado, así que la comparación no era válida: se repitieron `main` y el control con el equipo enchufado (BatteryStatus = 2, verificado antes y después). Las corridas a batería se conservan en `raw/regresion/k6-bateria-descartada/` y `raw/carga-inicial/main-bateria-descartada.json`, y se muestran en B2 solo como referencia.
- Scripts reproducibles en [`scripts/`](scripts/): `historial.mjs` (A1, A2, A4), `regresion.mjs` (B1), `carga-inicial.mjs` (B2) y `tablas.mjs` (genera las tablas de este archivo a partir de [`raw/`](raw/)).

---

## A. Historial y configuración

### A1. Commits de todas las ramas

58 commits alcanzables desde las 15 refs (locales y `origin/*`). Columnas por carpeta: `+líneas agregadas / −líneas borradas`. "raíz" son los archivos que están fuera de `src/`, `docs/` y `tests/`. Los archivos binarios no suman líneas.

**Rama de origen (deducida):** para los merges de PR se toma el mensaje "Merge pull request #N from …". Para el resto se usa `git name-rev` (la rama más cercana que contiene el commit), que es una aproximación: un commit de feature ya mergeado puede figurar con `origin/main` como rama. **En origin = no** indica que el commit existe solo en este equipo.

| # | Hash | Fecha | Autor (tal como figura) | Rama de origen (deducida) | En origin | Mensaje | src/ | docs/ | tests/ | raíz |
|---|---|---|---|---|---|---|---|---|---|---|
| 58 | bceec38 | 2026-10-26 20:49 | Tomy Varas | origin/main | sí | add: docs refresh room | — | +101 / −0 | — | — |
| 57 | 7afec48 | 2026-10-26 20:43 | Tomy Varas | origin/main | sí | fix: polling feed, room and chat to refresh UI for join/leave | +100 / −12 | — | — | — |
| 56 | caf5d66 | 2026-10-21 11:55 | Diego-Escorche | tp4-plan-pruebas | **no** | docs(testing): titulos con resultado esperado explicito en todas las pruebas | +6 / −6 | +151 / −151 | — | — |
| 55 | 1807d8e | 2026-10-21 11:54 | Diego-Escorche | tp4-plan-pruebas | **no** | docs(testing): resultados de la ejecucion del Plan de Pruebas (TP4) | +8 / −6 | +31.415 / −0 | +239 / −5 | +75 / −0 |
| 54 | f5f74d3 | 2026-10-21 11:41 | Diego-Escorche | tp4-plan-pruebas | **no** | fix(frontend): cabeceras de seguridad en nginx (DEF-04) | +27 / −0 | +3.910 / −0 | — | — |
| 53 | a784d40 | 2026-10-21 11:41 | Diego-Escorche | tp4-plan-pruebas | **no** | test: E2E con Playwright (Chromium y WebKit mobile), carga con k6 y ZAP baseline | — | +7.107 / −0 | +461 / −0 | — |
| 52 | 9347ad4 | 2026-10-21 11:17 | Diego-Escorche | tp4-plan-pruebas | **no** | fix(scrapper): close() del navegador tolera un start() fallido (DEF-03) | +12 / −5 | +2 / −0 | — | — |
| 51 | 0ee56db | 2026-10-21 11:16 | Diego-Escorche | tp4-plan-pruebas | **no** | fix(cache): GetTTL devuelve -1/-2 para claves sin vencimiento o inexistentes (DEF-02) | +4 / −0 | +6 / −0 | — | — |
| 50 | 9727b91 | 2026-10-21 11:16 | Diego-Escorche | tp4-plan-pruebas | **no** | fix(chat): reprogramar el flush cuando PushBatch falla (DEF-01) | +6 / −0 | +9 / −0 | — | — |
| 49 | 3ba285a | 2026-10-21 11:15 | Diego-Escorche | tp4-plan-pruebas | **no** | test: suites unitarias y de integracion del TP4 (Plan de Pruebas) | +8.443 / −47 | +80 / −0 | +300 / −0 | +10 / −0 |
| 48 | 655f973 | 2026-10-20 20:43 | Diego-Escorche | main | sí | #Commit: Proyecto funcional completado | +3.737 / −238 | +543 / −0 | — | +165 / −21 |
| 47 | 15e17b7 | 2026-10-20 20:42 | Diego-Escorche | main | sí | #Commit: Proyecto Finalizado | +0 / −343 | — | — | — |
| 46 | 9eca38b | 2026-10-19 10:17 | TomyVarasOviedo | main | sí | fix: reduccion de alcance y modificación de AGENTES.md | — | +20 / −0 | — | +19 / −14 |
| 45 | b648f32 | 2026-10-19 09:55 | Tomás Varas Oviedo | cache-chat (PR #3) | sí | [merge] Merge pull request #3 from odritaa/cache-chat | — | — | — | — |
| 44 | 27ee1e9 | 2026-10-19 09:44 | TomyVarasOviedo | origin/cache-chat | sí | add: Dockerfile to scrapper/chat/cache | +60 / −18 | +322 / −0 | — | +68 / −0 |
| 43 | 05943bf | 2026-09-16 11:07 | Tomy Varas | origin/cache-chat | sí | add: integracion chat <-> cache, terminada | +6.128 / −231 | +199 / −0 | — | — |
| 42 | aea4f93 | 2026-09-15 09:13 | TomyVarasOviedo | origin/cache-chat | sí | docs: Integracion chat-cache | — | +133 / −0 | — | — |
| 41 | c464c65 | 2026-09-08 19:13 | TomyVarasOviedo | origin/cache-chat | sí | [merge] Merge branch 'cache-scrapper' of https://github.com/odritaa/LumInsieme into cache-chat | — | — | — | — |
| 40 | d742501 | 2026-09-08 18:45 | TomyVarasOviedo | origin/cache-chat | sí | [merge] Merge branch 'chat-controller' of https://github.com/odritaa/LumInsieme into cache-chat | — | — | — | — |
| 39 | 5452eb8 | 2026-09-08 18:44 | TomyVarasOviedo | origin/cache-chat | sí | [merge] Merge branch 'cache-controller' of https://github.com/odritaa/LumInsieme into cache-chat | — | — | — | — |
| 38 | 0f534e6 | 2026-09-01 19:24 | Diego Escorche | main | sí | Delete src/frontend/node_modules directory | +0 / −858.193 | — | — | — |
| 37 | 040cb45 | 2026-09-01 19:24 | Diego Escorche | main | sí | Delete src/chat-controller directory from Chat Branch | +0 / −7.475 | — | — | — |
| 36 | 5146d75 | 2026-09-01 10:32 | TomyVarasOviedo | origin/cache-scrapper | sí | add: documentacion del proceso | — | +237 / −0 | — | — |
| 35 | 05ad76c | 2026-09-01 10:17 | TomyVarasOviedo | origin/cache-scrapper | sí | add: Integracion scrapper <-> cache, faltan pruebas | +1.294 / −274 | — | — | — |
| 34 | d79f99a | 2026-09-01 09:02 | TomyVarasOviedo | origin/cache-scrapper | sí | [merge] Merge branch 'cache-controller' of https://github.com/odritaa/LumInsieme into cache-scrapp | — | — | — | — |
| 33 | a2e36d3 | 2026-09-01 08:59 | TomyVarasOviedo | origin/cache-scrapper | sí | [merge] add: Cambios de rama scrapper | — | — | — | — |
| 32 | 1ddcaff | 2026-08-31 23:01 | Diego Escorche | chat (PR #2) | sí | [merge] Merge pull request #2 from odritaa/chat | — | — | — | — |
| 31 | de9bc4e | 2026-08-31 22:58 | Diego-Escorche | chat | sí | [merge] Merge branch 'main' into chat | — | — | — | — |
| 30 | ff28bb7 | 2026-08-31 22:41 | Diego Escorche | chat | sí | [merge] Merge pull request #1 from odritaa:login | — | — | — | — |
| 29 | 6dcc170 | 2026-08-31 22:11 | Diego-Escorche | chat | sí | #Add: Pruebas Estres | +7.475 / −0 | — | — | +10 / −5 |
| 28 | 9b94403 | 2026-08-11 20:27 | Tomy Varas | origin/cache-controller | sí | add: gRPC y TUI de pruebas | +3.708 / −0 | +337 / −0 | — | — |
| 27 | 6eb1cdd | 2026-08-10 22:15 | Diego-Escorche | chat | sí | Created chat branch | +979.199 / −0 | — | — | — |
| 26 | 00d0500 | 2026-08-05 12:10 | Diego-Escorche | login | sí | Add: Modulo de login con OAuth de manera local | +2.556 / −59 | — | — | +42 / −0 |
| 25 | 1d517e3 | 2026-08-04 19:45 | Tomy Varas | origin/scrapper | sí | fix: Arreglo de sobre informacion, peliculas con dias adecuados | +1 / −1 | — | — | — |
| 24 | b23c6fe | 2026-08-04 11:28 | TomyVarasOviedo | origin/scrapper | sí | fix: falta verificar error de archivo JSON (Estructura) | +7.100 / −31 | — | — | +3 / −199 |
| 23 | 163afcd | 2026-08-03 20:40 | Diego-Escorche | frontend | sí | Add: Front del mockup aplicado al proyecto actual | +1.868 / −448 | — | — | — |
| 22 | 12a5f23 | 2026-08-03 20:25 | Tomy Varas | chat-controller | sí | add:implementacion basica, faltan cosas | +1.709 / −0 | +49 / −0 | — | — |
| 21 | 635c7aa | 2026-07-16 14:05 | TomyVarasOviedo | origin/scrapper | sí | fix:cambio de frontend (Excepto main.py) | +258 / −4 | — | — | — |
| 20 | 012a339 | 2026-07-16 13:53 | TomyVarasOviedo | frontend | sí | fix: Docker file y ngnix para SSL | +16 / −1 | — | — | — |
| 19 | 4a653a6 | 2026-07-16 11:12 | TomyVarasOviedo | frontend | sí | add: Dockerfile para PoC | +33 / −0 | — | — | — |
| 18 | 0bfd554 | 2026-07-16 10:59 | TomyVarasOviedo | frontend | sí | fix: PoC adecuacion para EC2 scrapper | +51 / −7 | — | — | — |
| 17 | 049baa5 | 2026-07-15 19:21 | TomyVarasOviedo | origin/scrapper | sí | add: Dockerfile, preparacion para EC2 | +91 / −6 | — | — | — |
| 16 | f0cbf50 | 2026-07-15 19:16 | TomyVarasOviedo | frontend | sí | fix:adaptacion para ejecucion en EC2 | +58 / −3 | — | — | — |
| 15 | 37666a2 | 2026-07-14 19:29 | TomyVarasOviedo | frontend | sí | add: FastAPI y Redis | +217 / −9 | — | — | — |
| 14 | 684008e | 2026-07-14 19:26 | TomyVarasOviedo | frontend | sí | add: redaptacion de plantilla a React | +3.091 / −0 | — | — | — |
| 13 | 02acdf1 | 2026-07-12 19:53 | TomyVarasOviedo | origin/scrapper | sí | fix: error de dia, cambio a locator -> Falta implementacion demo | +30 / −74 | — | — | — |
| 12 | ba73b3c | 2026-07-11 21:56 | TomyVarasOviedo | origin/scrapper | sí | fix:arreglos finales -> falta implementacion y desiciones para demo | +435 / −10 | — | — | — |
| 11 | e8f3c7a | 2026-07-10 20:14 | TomyVarasOviedo | origin/scrapper | sí | fix: corregiendo error -> Falta screenings | +62 / −27 | — | — | +1 / −3 |
| 10 | 7165bd8 | 2026-07-09 19:30 | TomyVarasOviedo | origin/scrapper | sí | add: Estrategia Multiplex -> Faltan prueba | +101 / −22 | +1.370 / −0 | — | — |
| 9 | 21e913e | 2026-06-15 10:39 | TomyVarasOviedo | origin/scrapper | sí | [merge] Merge branch 'main' of https://github.com/odritaa/LumInsieme into scrapper | — | — | — | — |
| 8 | 4ddfe56 | 2026-06-12 20:06 | Tomy Varas | chat-controller | sí | add: AGENTES.md, documentación para agentes  y modificacion de archivo .gitignore | — | +100 / −0 | — | +143 / −0 |
| 7 | 81c8a2f | 2026-06-12 19:41 | Tomy Varas | origin/scrapper | sí | add: Comenzando a codificar estrategia | +51 / −15 | — | — | — |
| 6 | 4b94432 | 2026-06-11 19:27 | Tomy Varas | origin/scrapper | sí | add: Instruccciones de Scrapping para Multiplex | +12 / −1 | — | — | — |
| 5 | cd9ab41 | 2026-06-11 15:17 | TomyVarasOviedo | origin/scrapper | sí | add: Estructura y estrategias | +84 / −0 | — | — | — |
| 4 | 36a76d5 | 2026-06-09 10:31 | TomyVarasOviedo | origin/scrapper | sí | init: estructura y configuracion | +10 / −0 | — | — | +1 / −1 |
| 3 | 7a7d443 | 2026-06-09 09:53 | TomyVarasOviedo | chat-controller | sí | init: configuracion y estructura | — | — | — | +29 / −1 |
| 2 | 6ff3d1b | 2026-05-09 11:20 | Audrey Virginia Barrientos Galarza | chat-controller | sí | Add files via upload | — | — | — | +197 / −0 |
| 1 | b19533d | 2026-05-09 11:13 | Audrey Virginia Barrientos Galarza | chat-controller | sí | Initial commit | — | — | — | +1 / −0 |

Totales:

| Conjunto | Commits | src/ | docs/ | tests/ | raíz |
|---|---|---|---|---|---|
| Todos (no merge) | 48 | +1.028.041 / −867.566 | +46.091 / −151 | +1.000 / −5 | +764 / −244 |
| Merges | 10 | — | — | — | — |
| Total | 58 | +1.028.041 / −867.566 | +46.091 / −151 | +1.000 / −5 | +764 / −244 |
| …de src/: líneas dentro de `node_modules/` versionados | — | +120.976 / −0 | — | — | — |

Por autor, tal como figura en git. No se unificaron identidades, pero varias corresponden a la misma persona con distinto nombre o cuenta: "Tomy Varas", "TomyVarasOviedo" y "Tomás Varas Oviedo"; "Diego-Escorche" y "Diego Escorche". Los commits del TP4 figuran como "Diego-Escorche" porque es el `user.name` configurado en este equipo.

| Autor (tal como figura en git) | Commits | de ellos merges | Primer commit | Último commit | Líneas + / − |
|---|---|---|---|---|---|
| TomyVarasOviedo | 27 | 6 | 2026-06-09 | 2026-10-19 | +15.194 / −704 |
| Diego-Escorche | 15 | 1 | 2026-08-03 | 2026-10-21 | +1.047.866 / −1.334 |
| Tomy Varas | 9 | 0 | 2026-06-11 | 2026-10-26 | +12.638 / −260 |
| Diego Escorche | 4 | 2 | 2026-08-31 | 2026-09-01 | +0 / −865.668 |
| Audrey Virginia Barrientos Galarza | 2 | 0 | 2026-05-09 | 2026-05-09 | +198 / −0 |
| Tomás Varas Oviedo | 1 | 1 | 2026-10-19 | 2026-10-19 | +0 / −0 |

### A2. Ramas y tags

| Ref | Tipo | Último commit | Fecha | Autor | Mensaje | Atrás / adelante de origin/main |
|---|---|---|---|---|---|---|
| chat | local | de9bc4e | 2026-08-31 22:58 | Diego-Escorche | Merge branch 'main' into chat | 25 / 0 |
| chat-controller | local | 12a5f23 | 2026-08-03 20:25 | Tomy Varas | add:implementacion basica, faltan cosas | 45 / 0 |
| frontend | local | 163afcd | 2026-08-03 20:40 | Diego-Escorche | Add: Front del mockup aplicado al proyecto actual | 30 / 0 |
| login | local | 00d0500 | 2026-08-05 12:10 | Diego-Escorche | Add: Modulo de login con OAuth de manera local | 29 / 0 |
| main | local | 655f973 | 2026-10-20 20:43 | Diego-Escorche | #Commit: Proyecto funcional completado | 2 / 0 |
| tp4-plan-pruebas | local | caf5d66 | 2026-10-21 11:55 | Diego-Escorche | docs(testing): titulos con resultado esperado explicito en t | 2 / 8 |
| origin/cache-chat | remota | 27ee1e9 | 2026-10-19 09:44 | TomyVarasOviedo | add: Dockerfile to scrapper/chat/cache | 6 / 0 |
| origin/cache-controller | remota | 9b94403 | 2026-08-11 20:27 | Tomy Varas | add: gRPC y TUI de pruebas | 45 / 0 |
| origin/cache-scrapper | remota | 5146d75 | 2026-09-01 10:32 | TomyVarasOviedo | add: documentacion del proceso | 15 / 0 |
| origin/chat | remota | de9bc4e | 2026-08-31 22:58 | Diego-Escorche | Merge branch 'main' into chat | 25 / 0 |
| origin/chat-controller | remota | 12a5f23 | 2026-08-03 20:25 | Tomy Varas | add:implementacion basica, faltan cosas | 45 / 0 |
| origin/frontend | remota | 163afcd | 2026-08-03 20:40 | Diego-Escorche | Add: Front del mockup aplicado al proyecto actual | 30 / 0 |
| origin/login | remota | 00d0500 | 2026-08-05 12:10 | Diego-Escorche | Add: Modulo de login con OAuth de manera local | 29 / 0 |
| origin/main | remota | bceec38 | 2026-10-26 20:49 | Tomy Varas | add: docs refresh room | 0 / 0 |
| origin/scrapper | remota | 1d517e3 | 2026-08-04 19:45 | Tomy Varas | fix: Arreglo de sobre informacion, peliculas con dias adecua | 33 / 0 |

- **Tags y releases:** ninguno, ni locales ni en GitHub (`git tag` vacío; `/tags`, `/releases` y `/rulesets` devuelven `[]`).
- **Ramas desalineadas:**
  - `main` local está 2 commits atrás de `origin/main` (no se hizo pull).
  - Las ramas remotas `origin/cache-chat`, `origin/cache-controller`, `origin/cache-scrapper` y `origin/scrapper` no tienen rama local.
  - `tp4-plan-pruebas` no tiene contraparte remota.

### A3. Pull requests

Equivalente a `gh pr list --state all --limit 200 --json number,title,author,createdAt,mergedAt,headRefName,baseRefName,reviews,reviewDecision,additions,deletions,changedFiles`, más commits y comentarios. Hay 3 PRs en total, los 3 mergeados.

| # | Título | Autor | Creado (UTC) | Mergeado (UTC) | Minutos abierto | head → base | Reviews | reviewDecision | Commits | + / − | Archivos | Comentarios |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Cache chat | TomyVarasOviedo | 2026-10-19 12:55 | 2026-10-19 12:55 | 0,7 | cache-chat → main | ninguna | n/d (requiere GraphQL autenticado) | 16 | +20.995 / −285 | 70 | 0 |
| 2 | Pull Chat Branch | Diego-Escorche | 2026-09-01 01:47 | 2026-09-01 02:01 | 14,6 | chat → main | ninguna | n/d (requiere GraphQL autenticado) | 3 | +986.681 / −4 | 4.109 | 0 |
| 1 | Pull Login branch | Diego-Escorche | 2026-09-01 01:40 | 2026-09-01 01:41 | 0,9 | login → main | Diego-Escorche: COMMENTED | n/d (requiere GraphQL autenticado) | 1 | +2.598 / −59 | 37 | 0 |

- Los 3 PRs los mergeó su propio autor (`merged_by` = autor), sin aprobación de otra persona. La única review (PR #1) es un `COMMENTED` del mismo autor.
- El PR #2 suma +986 681 líneas en 4109 archivos: incluye `node_modules` y otros artefactos (ver B5).
- De los 50 commits de `origin/main`, 23 llegaron por PR: 20 commits de las ramas (1 + 3 + 16) más los 3 merges de PR. Los otros 27, incluidos 7 merges que no son de PR, llegaron por push o merge directo.

### A4. Evolución de la documentación

Todos los `.md` versionados en cualquier ref (README, AGENTES.md, minutas y documentos de `docs/`), sin contar `node_modules`. "Commits que lo tocan" incluye el de creación; "Modificaciones" = commits − 1. "Commits en main" cuenta solo la historia de `origin/main`. No se siguen renombres (`--follow`).

| Archivo | Creado (fecha / commit / autor) | Commits que lo tocan (todas las ramas) | Modificaciones | Última modificación | Commits en main | ¿Está en main? | ¿Está en tp4? |
|---|---|---|---|---|---|---|---|
| AGENTES.md | 2026-06-12 / 4ddfe56 / Tomy Varas | 2 | 1 | 2026-10-19 / 9eca38b | 2 | sí | sí |
| README.md | 2026-05-09 / b19533d / Audrey Virginia Barrientos Galarza | 4 | 3 | 2026-10-21 / 1807d8e | 3 | sí | sí |
| docs/2025-07-31-chat-grupal.md | 2026-08-03 / 12a5f23 / Tomy Varas | 1 | 0 | — | 1 | sí | sí |
| docs/2026-08-11-Implementacion-cache-controller-gRPC.md | 2026-08-11 / 9b94403 / Tomy Varas | 1 | 0 | — | 1 | sí | sí |
| docs/2026-09-01-Integracion-scrapper-cache-controller-gRPC.md | 2026-09-01 / 5146d75 / TomyVarasOviedo | 1 | 0 | — | 1 | sí | sí |
| docs/2026-09-08-Integracion-chat-controller-cache-controller-via-gRPC.md | 2026-09-15 / aea4f93 / TomyVarasOviedo | 1 | 0 | — | 1 | sí | sí |
| docs/2026-09-16-Integracion-chat-controller-cache-controller-via-gRPC.md | 2026-09-16 / 05943bf / Tomy Varas | 1 | 0 | — | 1 | sí | sí |
| docs/2026-10-19-Integracion-docker-scrapper-chat-cache.md | 2026-10-19 / 27ee1e9 / TomyVarasOviedo | 1 | 0 | — | 1 | sí | sí |
| docs/2026-10-20-reunion-controller-feed-salas-chat.md | 2026-10-20 / 655f973 / Diego-Escorche | 1 | 0 | — | 1 | sí | sí |
| docs/2026-10-26-refresco-miembros-salas.md | 2026-10-26 / bceec38 / Tomy Varas | 1 | 0 | — | 1 | sí | no |
| docs/CONTEXTO-INTEGRAL-PROYECTO.md | 2026-10-20 / 655f973 / Diego-Escorche | 1 | 0 | — | 1 | sí | sí |
| docs/Especificiaciones.md | 2026-06-12 / 4ddfe56 / Tomy Varas | 1 | 0 | — | 1 | sí | sí |
| docs/resolucion-2026-09-28-reduccion-alcance.md | 2026-10-19 / 9eca38b / TomyVarasOviedo | 1 | 0 | — | 1 | sí | sí |
| docs/testing/defectos.md | 2026-10-21 / 1807d8e / Diego-Escorche | 1 | 0 | — | 0 | no | sí |
| docs/testing/reportes/raw/tabla.md | 2026-10-21 / 1807d8e / Diego-Escorche | 2 | 1 | 2026-10-21 / caf5d66 | 0 | no | sí |
| docs/testing/reportes/zap/antes-zap-baseline.md | 2026-10-21 / a784d40 / Diego-Escorche | 1 | 0 | — | 0 | no | sí |
| docs/testing/reportes/zap/zap-baseline.md | 2026-10-21 / f5f74d3 / Diego-Escorche | 1 | 0 | — | 0 | no | sí |
| docs/testing/resultados-2026-10-21.md | 2026-10-21 / 1807d8e / Diego-Escorche | 2 | 1 | 2026-10-21 / caf5d66 | 0 | no | sí |
| src/chat-controller/README.md | 2026-08-31 / 6dcc170 / Diego-Escorche | 2 | 1 | 2026-09-01 / 040cb45 | 2 | no | no |
| src/login-controller/README.md | 2026-08-05 / 00d0500 / Diego-Escorche | 1 | 0 | — | 1 | sí | sí |
| src/reunion-controller/README.md | 2026-10-20 / 655f973 / Diego-Escorche | 1 | 0 | — | 1 | sí | sí |
| src/scrapper/docs/2026-07-16-minuta-cambios.md | 2026-07-16 / 635c7aa / TomyVarasOviedo | 1 | 0 | — | 1 | sí | sí |
| src/scrapper/docs/minuta-costos-aws.md | 2026-07-14 / 37666a2 / TomyVarasOviedo | 2 | 1 | 2026-07-16 / 635c7aa | 1 | sí | sí |
| src/scrapper/docs/minuta-implementacion-aws.md | 2026-07-11 / ba73b3c / TomyVarasOviedo | 3 | 2 | 2026-07-16 / 635c7aa | 2 | sí | sí |

- `src/chat-controller/README.md` se creó en `6dcc170` (31/08), se modificó y se borró en `040cb45` (01/09, "Delete src/chat-controller directory from Chat Branch"). No está en `main`.
- En dos documentos el nombre lleva una fecha distinta a la de su commit de creación: `docs/2025-07-31-chat-grupal.md`, creado el 03/08/2026, y `docs/2026-09-08-Integracion-chat-controller-cache-controller-via-gRPC.md`, creado el 15/09/2026.
- Los 5 `.md` de `docs/testing/` (TP4) existen solo en la rama local `tp4-plan-pruebas`.

### A5. Configuración de GitHub

| Aspecto | Dato | Fuente |
|---|---|---|
| Protección de `main` | **No protegida** (`protected: false`, `protection.enabled: false`, sin status checks) | `GET /branches/main` |
| Rulesets | Ninguno (`[]`) | `GET /rulesets` |
| Ramas protegidas | Ninguna de las 9 remotas | `GET /branches` |
| Issues | Habilitados (`has_issues: true`), **0 issues** creados. Las 3 entradas de `/issues` son los PRs | `GET /repos`, `GET /issues?state=all` |
| GitHub Actions / CI | **0 workflows**, 0 ejecuciones. No hay `.github/` en ninguna ref; los únicos archivos de CI del historial son `.travis.yml` de paquetes dentro de `node_modules` | `GET /actions/workflows`, `git log --all --name-only` |
| ¿`tp4-plan-pruebas` integrada en `main`? | **No.** No es ancestro de `origin/main` (8 commits adelante, 2 atrás) y **no existe en el remoto** (`git ls-remote --heads origin tp4-plan-pruebas` vacío). `git merge-tree origin/main tp4-plan-pruebas` termina sin conflictos | git |

---

## B. Control de calidad sobre `main` (`bceec38`)

### B1. Regresión de las suites del TP4

Totales por herramienta. "Pasaron el 21/10" es la corrida oficial del TP4 sobre `tp4-plan-pruebas`.

| Herramienta | Pruebas | Pasaron en main (27/10) | Fallaron en main | Pasaron el 21/10 | Diferencia |
|---|---|---|---|---|---|
| Vitest + Supertest | 112 | 111 | 1 | 112 | -1 |
| Vitest + RTL | 34 | 34 | 0 | 34 | 0 |
| go test + Testify + miniredis | 17 | 16 | 1 | 17 | -1 |
| pytest | 19 | 17 | 2 | 19 | -2 |
| Playwright | 8 | 7 | 1 | 8 | -1 |
| k6 | 5 | 4 | 1 | 5 | -1 |
| OWASP ZAP baseline | 3 | 1 | 2 | 3 | -2 |

Diferencias contra el 21/10. Son todas las pruebas cuyo resultado cambió; no hay pruebas nuevas ni faltantes.

| ID | Herramienta | 21/10 (tp4) | 27/10 (main) | Detalle de la falla |
|---|---|---|---|---|
| PT-CU05-20 | Vitest + Supertest | pasó | falló | AssertionError: expected "pushBatch" to be called 2 times, but got 1 times |
| PT-TR-16 | pytest | pasó | falló | assert False |
| PT-TR-24 | pytest | pasó | falló | AttributeError: 'PlaywrightBrowserController' object has no attribute 'context' |
| PT-TR-35 | go test + Testify + miniredis | pasó | falló | expected: -1; actual : 0; expected: -2; actual : 0 |
| PT-TR-57 | Playwright | pasó | falló | mobile-chromium: failed, mobile-webkit: failed |
| PT-TR-64 | k6 | pasó | falló | p95 por ráfaga 221 / 122 / 110 / 125 / 129 ms |
| PT-TR-71 | OWASP ZAP baseline | pasó | falló | alertas presentes: 10038, 10020, 10021, 10035, 10063 |
| PT-TR-72 | OWASP ZAP baseline | pasó | falló | alertas presentes: 10036, 10037 |

- Siete de las ocho diferencias son las comprobaciones de DEF-01 a DEF-04, que fallan porque sus correcciones están solo en `tp4-plan-pruebas`. PT-TR-16 es la aserción sobre `is_running()` que se agregó con la corrección de DEF-03.
- **PT-TR-64** falla por la primera ráfaga en frío: 221 ms contra el umbral de 200. Es el fenómeno de OBS-01. El backend de `main` es idéntico al del 21/10 (los commits nuevos solo tocan el frontend), y el control con el código del 21/10, en la misma sesión, dio 173 ms en esa ráfaga.
- Los cambios de `main` posteriores al TP4 (`7afec48`, polling de feed, sala y chat) **no rompieron ninguna prueba**: el frontend pasa 34/34 y el E2E 14/16 (las 2 fallas son PT-TR-57 por DEF-04).

Métricas de k6, mismas condiciones de energía que el control (equipo enchufado):

| ID | 21/10 (tp4) | 27/10 main (enchufado) |
|---|---|---|
| PT-TR-60 | p95 6,0 ms | p95 6,3 ms |
| PT-TR-61 | p95 10,0 ms | p95 10,4 ms |
| PT-TR-62 | p95 107,4 ms / 111,1 ms | p95 123,4 ms / 126,4 ms |
| PT-TR-63 | entrega p95 3,0 ms; ticket p95 255,7 ms | entrega p95 3,0 ms; ticket p95 196,4 ms |
| PT-TR-64 | p95 por ráfaga 184 / 100 / 92 / 102 / 100 ms | p95 por ráfaga 221 / 122 / 110 / 125 / 129 ms |

Control con el código del 21/10 (`tp4-plan-pruebas`), misma sesión y equipo enchufado: PT-TR-60/61 p95 de 6,2 / 10,6 ms; PT-TR-62 de 130,9 / 134,6 ms; PT-TR-63 entrega p95 de 4 ms (ticket 237,7 ms); PT-TR-64 ráfagas de 173 / 176 / 139 / 114 / 123 ms. Con 200 VUs, `main` y el control quedan a menos de 10 ms de distancia. Crudo en [`raw/control-tp4/k6/`](raw/control-tp4/k6/).

Primera tanda, a batería (descartada): PT-TR-60/61 p95 de 68,9 / 90,3 ms; PT-TR-62 de 859,4 / 871,5 ms; ticket del chat 440,9 ms; ráfagas de 386 / 279 / 229 / 261 / 265 ms. Crudo en [`raw/regresion/k6-bateria-descartada/`](raw/regresion/k6-bateria-descartada/).

### B2. Carga inicial (RNF: menos de 2 s)

- **Método:** Playwright con Chromium y el dispositivo Pixel 7 (viewport mobile 412×915, DPR 2,625), contra `https://localhost:8443` (nginx del stack de pruebas construido desde `main`).
- **Corridas:** "Sin caché" = contexto nuevo en cada corrida (5). "Con caché" = un contexto compartido, una visita previa de calentamiento y 5 visitas medidas.
- **Certificado:** el autofirmado se acepta por su SPKI (`--ignore-certificate-errors-spki-list`). Con `ignoreHTTPSErrors`, Chromium no usa su caché HTTP y la medición "con caché" sale inválida (comprobado; crudo en `raw/carga-inicial/main-descartada-certificado.json`).
- **Métricas:**
  - **FCP:** `first-contentful-paint`.
  - **LCP:** último `largest-contentful-paint`.
  - **Usable:** momento en que el primer control está visible y habilitado. En `/` es el botón de Google; en `/feed`, la pestaña "Salas abiertas" más la cartelera o el estado vacío ya cargados.
  - **Transferido:** suma de `encodedDataLength` (CDP), incluidas las fuentes de Google (2 pedidos externos por carga).
- **Perfiles de red:** "local" sin limitaciones, y "Slow 4G + CPU 4×" (150 ms de latencia, 1,6 Mbps de bajada, 750 kbps de subida y CPU 4 veces más lenta), que es el perfil mobile por defecto de Lighthouse.

**`main` (equipo enchufado):**

| Red | Página | Caché | Corridas | FCP mediana / peor (ms) | LCP mediana / peor (ms) | Usable mediana / peor (ms) | Transferido mediana / peor (KB) | Pedidos | Servidos de caché |
|---|---|---|---|---|---|---|---|---|---|
| local, sin throttling | / (login) | sin caché | 5 | 180 / 940 | 220 / 940 | 213 / 929 | 340,1 / 340,1 | 6 | 0 |
| local, sin throttling | / (login) | con caché | 5 | 76 / 92 | 104 / 120 | 96 / 113 | 0,4 / 0,4 | 6 | 5 |
| local, sin throttling | /feed (con sesión) | sin caché | 5 | 168 / 188 | 264 / 308 | 228 / 240 | 361,5 / 361,5 | 8 | 0 |
| local, sin throttling | /feed (con sesión) | con caché | 5 | 80 / 84 | 116 / 116 | 126 / 135 | 0,8 / 0,8 | 8 | 5 |
| Slow 4G + CPU 4× | / (login) | sin caché | 5 | 2.168 / 2.232 | 2.664 / 2.752 | 2.547 / 2.578 | 340,1 / 340,1 | 6 | 0 |
| Slow 4G + CPU 4× | / (login) | con caché | 5 | 460 / 512 | 776 / 844 | 768 / 828 | 0,4 / 0,4 | 6 | 5 |
| Slow 4G + CPU 4× | /feed (con sesión) | sin caché | 5 | 2.176 / 2.288 | 2.708 / 2.848 | 2.799 / 2.936 | 361,5 / 361,5 | 8 | 0 |
| Slow 4G + CPU 4× | /feed (con sesión) | con caché | 5 | 476 / 684 | 1.496 / 1.708 | 1.083 / 1.298 | 0,8 / 0,8 | 8 | 5 |

**Control: código del 21/10 (`tp4-plan-pruebas`), misma sesión y equipo enchufado:**

| Red | Página | Caché | Corridas | FCP mediana / peor (ms) | LCP mediana / peor (ms) | Usable mediana / peor (ms) | Transferido mediana / peor (KB) | Pedidos | Servidos de caché |
|---|---|---|---|---|---|---|---|---|---|
| local, sin throttling | / (login) | sin caché | 5 | 212 / 932 | 252 / 932 | 246 / 918 | 340,4 / 340,4 | 6 | 0 |
| local, sin throttling | / (login) | con caché | 5 | 144 / 168 | 168 / 188 | 156 / 181 | 0,0 / 0,0 | 6 | 5 |
| local, sin throttling | /feed (con sesión) | sin caché | 5 | 220 / 224 | 320 / 332 | 268 / 303 | 361,3 / 361,3 | 8 | 0 |
| local, sin throttling | /feed (con sesión) | con caché | 5 | 132 / 152 | 168 / 192 | 175 / 203 | 20,5 / 20,5 | 8 | 5 |
| Slow 4G + CPU 4× | / (login) | sin caché | 5 | 2.208 / 2.260 | 2.680 / 2.776 | 2.546 / 2.667 | 340,4 / 340,6 | 6 | 0 |
| Slow 4G + CPU 4× | / (login) | con caché | 5 | 532 / 540 | 836 / 924 | 824 / 911 | 0,0 / 0,0 | 6 | 5 |
| Slow 4G + CPU 4× | /feed (con sesión) | sin caché | 5 | 2.212 / 2.304 | 2.748 / 2.832 | 2.840 / 2.896 | 361,3 / 361,3 | 8 | 0 |
| Slow 4G + CPU 4× | /feed (con sesión) | con caché | 5 | 536 / 696 | 1.496 / 1.680 | 1.095 / 1.296 | 20,5 / 20,5 | 8 | 5 |

**`main` a batería (descartada, solo como referencia):**

| Red | Página | Caché | Corridas | FCP mediana / peor (ms) | LCP mediana / peor (ms) | Usable mediana / peor (ms) | Transferido mediana / peor (KB) | Pedidos | Servidos de caché |
|---|---|---|---|---|---|---|---|---|---|
| local, sin throttling | / (login) | sin caché | 5 | 340 / 1.368 | 440 / 1.368 | 421 / 1.331 | 340,1 / 340,1 | 6 | 0 |
| local, sin throttling | / (login) | con caché | 5 | 188 / 476 | 276 / 652 | 262 / 628 | 0,4 / 0,4 | 6 | 5 |
| local, sin throttling | /feed (con sesión) | sin caché | 5 | 264 / 292 | 480 / 496 | 423 / 515 | 361,5 / 361,5 | 8 | 0 |
| local, sin throttling | /feed (con sesión) | con caché | 5 | 192 / 236 | 244 / 376 | 281 / 398 | 0,8 / 0,8 | 8 | 5 |
| Slow 4G + CPU 4× | / (login) | sin caché | 5 | 5.944 / 7.844 | 6.080 / 9.992 | 8.067 / 9.929 | 340,1 / 340,1 | 6 | 0 |
| Slow 4G + CPU 4× | / (login) | con caché | 5 | 4.632 / 5.364 | 6.116 / 6.816 | 6.071 / 6.777 | 0,4 / 0,4 | 6 | 5 |
| Slow 4G + CPU 4× | /feed (con sesión) | sin caché | 5 | 6.044 / 6.240 | 8.540 / 8.952 | 9.232 / 9.377 | 361,5 / 361,5 | 8 | 0 |
| Slow 4G + CPU 4× | /feed (con sesión) | con caché | 5 | 4.604 / 5.444 | 6.556 / 7.188 | 7.267 / 7.639 | 0,8 / 0,8 | 8 | 5 |

Datos complementarios:

- **Contra el RNF:** sin throttling, todas las cargas quedan por debajo de 1 s (peor caso: 940 ms, primera carga en frío del login). Con Slow 4G + CPU 4× y **sin caché**, ninguna página llega a usable en menos de 2 s: mediana de 2,55 s en el login y 2,80 s en el feed. Con caché sí: 0,77 s y 1,08 s.
- **Peso del bundle:** el JS (`index-B7P1yJnB.js`) pesa 268 136 bytes y el CSS 27 401, y **nginx los sirve sin compresión** (sin `Content-Encoding`; la imagen oficial trae `gzip` apagado). Con gzip nivel 6 bajarían a 83 886 y 5 690 bytes; con brotli, a 72 869 y 5 043.
- **Caché de assets:** nginx no envía `Cache-Control` ni `Expires` para `/assets/` (solo `Last-Modified` y `ETag`). La reutilización observada depende de la heurística del navegador.
- **Cascada con caché bajo throttling** (`/feed`, una corrida, todo servido desde caché): el HTML a los 0–3 ms, el JS entre 1122 y 1126 ms, `/auth/me` entre 4066 y 4266 ms, y recién después `/salas` y `/cartelera` (de 6216 a 6460 ms). La espera es de CPU (parseo y ejecución del JS) y la app no pide los datos hasta que `/auth/me` responde. Esa cascada se tomó durante la tanda a batería.
- **Costo del `no-store` de DEF-04:** con caché, el feed del control transfiere 20,5 KB y el de `main` 0,8 KB. La diferencia son las respuestas de `/auth` y `/salas`, que el control vuelve a bajar completas en cada visita.

### B3. Análisis estático (sin corregir)

oxlint 1.74.0 sobre `src/` de cada paquete. El frontend usa su `.oxlintrc.json`; los servicios Node no tienen configuración propia y corren con las reglas por defecto (categoría *correctness*).

| Paquete (src/) | Archivos | Reglas activas | Errores | Warnings | Regla (ubicación) |
|---|---|---|---|---|---|
| frontend | 25 | 91 | 0 | 1 | warning · react(only-export-components) (src/contexts/AppContext.jsx:211) |
| login-controller | 16 | 95 | 0 | 0 | — |
| reunion-controller | 20 | 95 | 0 | 0 | — |
| chat-controller | 7 | 95 | 0 | 0 | — |

Go (`go vet`, staticcheck) y Python (ruff):

| Herramienta | Alcance | Hallazgos | Severidad | Regla | Ubicación | Mensaje |
|---|---|---|---|---|---|---|
| go vet | cache-controller ./... (6 paquetes) | 0 | — | — | — | — |
| staticcheck 2025.1.1 | cache-controller ./... | 1 | error | SA1019 | cmd/testclient/main.go:19 | grpc.DialContext is deprecated: use NewClient instead.  Will be supported throughout 1.x. |
| ruff 0.14.1 (reglas por defecto: E4, E7, E9, F) | scrapper (sin tests/) | 1 | error (ruff no gradúa) | F401 | grpc_client.py:3 | `grpc` imported but unused |
| ruff 0.14.1 (reglas por defecto: E4, E7, E9, F) | scrapper (sin tests/) | 1 | error (ruff no gradúa) | F401 | pb/cache_pb2_grpc.py:4 (código generado) | `warnings` imported but unused |
| ruff 0.14.1 (reglas por defecto: E4, E7, E9, F) | scrapper (sin tests/) | 1 | error (ruff no gradúa) | F401 | strategies/multiplexScrapping.py:6 | `playwright.async_api.expect` imported but unused |

Resumen por severidad: oxlint 0 errores y 1 warning; go vet 0; staticcheck 1 (SA1019, `severity: error` según staticcheck); ruff 3 (F401), de los cuales 1 está en código gRPC generado (`pb/`).

### B4. Vulnerabilidades de dependencias

**npm audit** sobre los `package-lock.json` de `origin/main` (sin las dependencias de prueba del TP4):

| Paquete | Dependencias | Critical | High | Moderate | Low | Total | Solo producción C / H / M / L (total) |
|---|---|---|---|---|---|---|---|
| login-controller | 128 | 1 | 2 | 1 | 0 | 4 | 1 / 1 / 1 / 0 (3) |
| reunion-controller | 162 | 0 | 1 | 0 | 0 | 1 | 0 / 1 / 0 / 0 (1) |
| chat-controller | 148 | 1 | 3 | 1 | 0 | 5 | 1 / 2 / 1 / 0 (4) |
| frontend | 154 | 0 | 4 | 3 | 0 | 7 | 0 / 0 / 0 / 0 (0) |

| Paquete | Dependencia afectada | Severidad | Rango vulnerable | Tipo | Alcance | Advisory | Descripción | Fix |
|---|---|---|---|---|---|---|---|---|
| login-controller | body-parser | high | <1.20.9 | transitiva | producción | GHSA-27r3-jxmh-p828 | body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body | sí (npm audit fix) |
| login-controller | brace-expansion | high | 4.0.0 - 5.0.11 | transitiva | solo desarrollo | GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p | brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service; brace-expansion: DoS via | sí (npm audit fix) |
| login-controller | proxy-addr | critical | 1.1.0 - 2.0.7 | transitiva | producción | GHSA-jqcg-44mw-7w3h | proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet | sí (npm audit fix) |
| login-controller | qs | moderate | 2.2.5 - 6.16.0 | transitiva | producción | GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw | qs array-limit bypass via bracket-key comma parsing; qs: Denial of Service via Attacker Controlled isBuffer; qs : qs.str | sí (npm audit fix) |
| reunion-controller | body-parser | high | <1.20.9 | transitiva | producción | GHSA-27r3-jxmh-p828 | body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body | sí (npm audit fix) |
| chat-controller | @grpc/grpc-js | high | 1.14.0 - 1.14.4 | directa | producción | GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4 | @grpc/grpc-js: In certain configurations, getAuthContext can return unauthorized certificates as though they were author | sí (npm audit fix) |
| chat-controller | body-parser | high | <1.20.9 | transitiva | producción | GHSA-27r3-jxmh-p828 | body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body | sí (npm audit fix) |
| chat-controller | brace-expansion | high | 4.0.0 - 5.0.11 | transitiva | solo desarrollo | GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p | brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service; brace-expansion: DoS via | sí (npm audit fix) |
| chat-controller | proxy-addr | critical | 1.1.0 - 2.0.7 | transitiva | producción | GHSA-jqcg-44mw-7w3h | proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet | sí (npm audit fix) |
| chat-controller | qs | moderate | 2.2.5 - 6.16.0 | transitiva | producción | GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw | qs array-limit bypass via bracket-key comma parsing; qs: Denial of Service via Attacker Controlled isBuffer; qs : qs.str | sí (npm audit fix) |
| frontend | baseline-browser-mapping | moderate | >=2.0.0 <2.11.0 | transitiva | solo desarrollo | GHSA-w5vr-8v7q-w6rv | baseline-browser-mapping process termination on invalid input causes denial of service | sí (npm audit fix) |
| frontend | browserslist | high | <=4.28.6 | transitiva | solo desarrollo | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g | Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM; Browsersl | sí (npm audit fix) |
| frontend | nanoid | high | <3.3.18 | transitiva | solo desarrollo | GHSA-2v37-7h3g-55p8 | nanoid: custom generators can loop indefinitely when size is zero | sí (npm audit fix) |
| frontend | postcss | moderate | <=8.5.22 | directa | solo desarrollo | GHSA-fxqj-rqcc-2cmp | PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `f | sí (npm audit fix) |
| frontend | postcss-selector-parser | moderate | <6.1.5 | transitiva | solo desarrollo | GHSA-rj75-hqrm-r3gf | PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion | sí (npm audit fix) |
| frontend | source-map-js | high | 1.0.0 - 1.2.1 | transitiva | solo desarrollo | GHSA-68fv-2mgg-jv7q | source-map-js allows event-loop denial of service through indexed source-map section offsets | sí (npm audit fix) |
| frontend | vite | high | 8.0.0 - 8.1.5 | directa | solo desarrollo | GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm, GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22 | launch-editor: escapeCmdArgs() omits % escaping on Windows; launch-editor: Editor CLI flag misinterpretation causing arb | sí (npm audit fix) |

**pip-audit** sobre `src/scrapper/requirements.txt` de `main` (12 paquetes resueltos). pip-audit no informa severidad; se toma la de GitHub Advisory:

| Paquete | Versión | ID | Alias | Severidad (GitHub Advisory) | Fix | Descripción |
|---|---|---|---|---|---|---|
| python-dotenv | 1.0.0 | PYSEC-2026-2270 | GHSA-mf9w-mj56-hr94, CVE-2026-28684 | medium | 1.2.2 | python-dotenv reads key-value pairs from a .env file and can set them as environment variables. Prior to version 1.2.2, `set_key()` and `uns |

**govulncheck** sobre `src/cache-controller` (`./...`, base de datos vuln.go.dev al 27/10). govulncheck no asigna severidad: clasifica por alcance. Se agrega la severidad de GitHub Advisory donde el aviso tiene ID GHSA; los avisos de la stdlib de Go no lo tienen y quedan como n/d.

| Alcance | Avisos |
|---|---|
| alcanzable (se llama al símbolo) | 10 |
| paquete importado, símbolo no llamado | 6 |
| solo en el módulo (no importado) | 3 |
| Total | 19 |

| ID | Alias | Módulo | Versión usada | Corregido en | Alcance (govulncheck) | Severidad (GitHub Advisory) | Resumen |
|---|---|---|---|---|---|---|---|
| GO-2026-6348 | CVE-2026-84304, GHSA-vp52-pcj8-j9qc | google.golang.org/grpc | v1.83.0 | v1.83.1 | alcanzable (se llama al símbolo) | high | Heap Memory Exhaustion (OOM) via HTTP/2 DATA Frame Fragmentation in google.golang.org/grpc |
| GO-2026-6443 | CVE-2026-84445, GHSA-2v4p-qf9q-27wj | google.golang.org/grpc | v1.83.0 | v1.83.2 | alcanzable (se llama al símbolo) | high | Server panic via missing authority or Host headers in google.golang.org/grpc |
| GO-2026-6603 | CVE-2026-78659 | stdlib | v1.25.14 | v1.26.9 | alcanzable (se llama al símbolo) | n/d | HTTP/2 server memory exhaustion due to Trailer headers in net/http |
| GO-2026-6607 | CVE-2026-97031 | stdlib | v1.25.14 | v1.26.9 | alcanzable (se llama al símbolo) | n/d | Reject malformed ECH outer extension references in crypto/tls |
| GO-2026-6608 | CVE-2026-94440 | stdlib | v1.25.14 | v1.26.9 | alcanzable (se llama al símbolo) | n/d | Memory limit bypass when parsing MIME headers in net/textproto, mime/multipart |
| GO-2026-6611 | CVE-2026-78669 | stdlib | v1.25.14 | v1.26.9 | alcanzable (se llama al símbolo) | n/d | Excessive CPU consumption from repeated initial window changes in net/http |
| GO-2026-6612 | CVE-2026-78663 | stdlib | v1.25.14 | v1.26.9 | alcanzable (se llama al símbolo) | n/d | Double flow control refund on HTTP/2 server streams in net/http |
| GO-2026-6613 | CVE-2026-94439 | stdlib | v1.25.14 | v1.26.9 | alcanzable (se llama al símbolo) | n/d | HTTP/1 server connection desynchronization after 2xx CONNECT response in net/http |
| GO-2026-6617 | CVE-2026-97032 | stdlib | v1.25.14 | v1.26.9 | alcanzable (se llama al símbolo) | n/d | HTTP/2 server crash due to HPACK encoder race in net/http |
| GO-2026-6809 | CVE-2026-111943 | stdlib | v1.25.14 | v1.26.10 | alcanzable (se llama al símbolo) | n/d | Distrust compromised intermediate certificates in crypto/x509 |
| GO-2026-6599 | CVE-2026-94448 | stdlib | v1.25.14 | v1.26.9 | paquete importado, símbolo no llamado | n/d | Reset context tracking on consecutive template expressions in html/template |
| GO-2026-6600 | CVE-2026-97030 | stdlib | v1.25.14 | v1.26.9 | paquete importado, símbolo no llamado | n/d | Recognize yield as regexp preceder keyword in html/template |
| GO-2026-6604 | CVE-2026-56857 | stdlib | v1.25.14 | v1.26.9 | paquete importado, símbolo no llamado | n/d | Root.Mkdir(All) can follow junctions out of the root on Windows in os |
| GO-2026-6605 | CVE-2026-56866 | stdlib | v1.25.14 | v1.26.9 | paquete importado, símbolo no llamado | n/d | HTTP/1 client connection desynchronization after CONNECT rejection in net/http |
| GO-2026-6609 | CVE-2026-78667 | stdlib | v1.25.14 | v1.26.9 | paquete importado, símbolo no llamado | n/d | Lack of limit on size of parsed Range headers in net/http |
| GO-2026-6610 | CVE-2026-78660 | stdlib | v1.25.14 | v1.26.9 | paquete importado, símbolo no llamado | n/d | HTTP/2 transport accepts malformed framing-related headers in net/http |
| GO-2026-6441 | CVE-2026-84303, GHSA-qc2q-p7wx-3px3 | google.golang.org/grpc | v1.83.0 | v1.83.1 | solo en el módulo (no importado) | medium | Bypass of xDS RBAC HTTP filter header matching in google.golang.org/grpc |
| GO-2026-6860 | CVE-2026-78661 | golang.org/x/net | v0.57.0 | v0.62.0 | solo en el módulo (no importado) | n/d | Avoid quadratic complexity when coalescing text nodes in html in golang.org/x/net |
| GO-2026-6866 | CVE-2026-97045 | golang.org/x/net | v0.57.0 | v0.62.0 | solo en el módulo (no importado) | n/d | Check all ancestor namespace transitions when rendering raw text in html in golang.org/x/net |

Los 14 avisos de la stdlib corresponden al toolchain con que se compila la imagen (`golang:1.25` → go1.25.14). Los de `google.golang.org/grpc` y `golang.org/x/net` corresponden a versiones fijadas en `go.mod`.

### B5. Higiene del repositorio

**gitleaks detect** sobre la historia de todas las refs (`--log-opts=--all`, salida redactada): 45 commits con diff escaneados, 53,7 MB, **2 hallazgos**.

| Regla | Archivo | Línea | Commit | Fecha | Coincidencia (redactada) | Entropía |
|---|---|---|---|---|---|---|
| generic-api-key | docs/multiplex-codigo-fuente.txt | 1141 | 7165bd8 | 2026-07-09 | data-sitekey="REDACTED" | 4,63 |
| generic-api-key | src/scrapper/docs/multiplex.com.ar-codigo-fuente.html | 3 | 7165bd8 | 2026-07-09 | token":"REDACTED" | 3,55 |

- Los dos están en copias guardadas del HTML **público** de multiplex.com.ar: una `data-sitekey` de reCAPTCHA, que es pública por diseño, y un `token` embebido en la página. **No son secretos del proyecto.**
- **Ningún `.env` real se commiteó nunca:** en la historia completa solo aparecen `.env.example`, y sus claves sensibles (`POSTGRES_PASSWORD`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) están vacías.
- Ni `tests/stack/test.env` ni `fixtures.local.json` del TP4 figuran en la historia.

**Artefactos generados versionados en `origin/main`** (1372 archivos, 51,07 MB en total):

| Grupo | Archivos | Tamaño (MB) | % del árbol de main | Ejemplos |
|---|---|---|---|---|
| src/login-controller/node_modules/ | 1185 | 4,30 | 8,4 % | src/login-controller/node_modules/.bin/mime, src/login-controller/node_modules/.bin/mime.cmd, src/login-controller/node_modules/.bin/mime.ps1 |
| src/frontend/dist/ (build de Vite) | 4 | 0,29 | 0,6 % | src/frontend/dist/assets/index-2yzlc95j.js, src/frontend/dist/assets/index-C3AnEHVw.css, src/frontend/dist/favicon.svg |
| binarios ELF de Go (cache-controller, testclient) | 2 | 39,71 | 77,8 % | src/cache-controller/cache-controller, src/cache-controller/testclient |
| __pycache__ / *.pyc | 8 | 0,02 | 0 % | src/scrapper/models/__pycache__/__init__.cpython-311.pyc, src/scrapper/models/__pycache__/browserController.cpython-311.pyc, src/scrapper/strategies/__pycache__/__init__.cpython-311.pyc |
| gRPC Go: pb/ | 2 | 0,08 | 0,2 % | src/cache-controller/pb/cache.pb.go, src/cache-controller/pb/cache_grpc.pb.go |
| gRPC Go: proto/*.pb.go | 2 | 0,08 | 0,2 % | src/cache-controller/proto/cache.pb.go, src/cache-controller/proto/cache_grpc.pb.go |
| gRPC Go: github.com/... (copia anidada) | 2 | 0,08 | 0,2 % | src/cache-controller/github.com/odritaa/LumInsieme/src/cache-controller/pb/cache.pb.go, src/cache-controller/github.com/odritaa/LumInsieme/src/cache-controller/pb/cache_grpc.pb.go |
| gRPC Python: scrapper/pb/*_pb2*.py (generado) | 2 | 0,03 | 0,1 % | src/scrapper/pb/cache_pb2.py, src/scrapper/pb/cache_pb2_grpc.py |
| scrapper/requests/.timeline y .noodle (estado de cliente HTTP) | 9 | 0,05 | 0,1 % | src/scrapper/requests/.noodle/ui-state.yml, src/scrapper/requests/.timeline/example.yml, src/scrapper/requests/.timeline/observaciones-lusat.yml |
| scrapper/moviesData.json (salida de scraping) | 1 | 0,13 | 0,3 % | src/scrapper/moviesData.json |
| HTML/TXT guardados de multiplex.com.ar | 2 | 5,63 | 11 % | docs/multiplex-codigo-fuente.txt, src/scrapper/docs/multiplex.com.ar-codigo-fuente.html |

- **Código gRPC de Go triplicado:** `pb/cache.pb.go`, `proto/cache.pb.go` y `github.com/odritaa/LumInsieme/src/cache-controller/pb/cache.pb.go` son el **mismo blob** (`decc267d`), y lo mismo pasa con `cache_grpc.pb.go` (`19662dcc`). Todo el código Go (`main.go`, `server.go`, `tui/`, `cmd/testclient/`) importa solo `pb/`.
- **Binarios ELF:** `cache-controller` (25,1 MB) y `testclient` (14,6 MB) son ejecutables Linux x86-64 con información de depuración, y la imagen Docker los recompila.
- **`dist/` desactualizado:** el build versionado en `src/frontend/dist/` es del 10/08/2026 (`6eb1cdd`) y referencia `index-2yzlc95j.js`. El código del frontend cambió por última vez el 26/10 (`7afec48`) y hoy compila a `index-B7P1yJnB.js`. El Dockerfile genera su propio `dist`, así que el versionado no se usa.
- **Artefacto agregado por el TP4:** `src/scrapper/.coverage`, un archivo de datos de coverage.py de 53 248 bytes. Entró por error en `1807d8e` (21/10). Está solo en `tp4-plan-pruebas` y no está ignorado en `.gitignore`.

### B6. Estado de los defectos y observaciones del TP4

| Defecto | Corrección | ¿En `tp4-plan-pruebas`? | ¿En `origin/main`? | ¿En el remoto? | Comprobación en `main` (27/10) | Estado |
|---|---|---|---|---|---|---|
| DEF-01 (chat, reintento de PushBatch) | `9727b91` | sí | no | no | PT-CU05-20 falla | Corregido en la rama, **abierto en `main`** |
| DEF-02 (cache, `GetTTL` -1/-2) | `0ee56db` | sí | no | no | PT-TR-35 falla | Corregido en la rama, **abierto en `main`** |
| DEF-03 (scrapper, `close()` tras `start()` fallido) | `9347ad4` | sí | no | no | PT-TR-24 y PT-TR-16 fallan | Corregido en la rama, **abierto en `main`** |
| DEF-04 (nginx, cabeceras de seguridad) | `f5f74d3` | sí | no | no | PT-TR-57 falla en los 2 navegadores; ZAP: 3 Medium y 8 Low, igual que antes de la corrección | Corregido en la rama, **abierto en `main`** |

| Observación | Situación al 27/10 en `main` |
|---|---|
| OBS-01 (ticket de chat en ráfaga en frío) | Persiste: primera ráfaga de 221 ms (PT-TR-64 falla en sentido estricto); ticket del chat en PT-TR-63, 196 ms. El código no cambió |
| OBS-02 (ticket en la URL del WebSocket) | Persiste: ZAP 10024 presente |
| OBS-03 (el chat no revalida la membresía) | Sin cambios: `chat-controller` es idéntico en `main` |
| OBS-04 (scrapper: `SCRAPPING_DAYS`, `config.py`, `__main__`) | Sin cambios. ruff suma 2 imports sin usar en `grpc_client.py` y `multiplexScrapping.py` |
| OBS-05 (sala vencida solo por fecha) | Sin cambios: `reunion-controller` es idéntico en `main` |
| OBS-06 (`node_modules` versionado, CRLF en `.go`) | Persiste: 1185 archivos y 4,30 MB en `src/login-controller/node_modules` (ver B5) |

#### Contenido completo de `docs/testing/defectos.md` (rama `tp4-plan-pruebas`, commit `1807d8e`)

Se transcribe sin cambios de texto. Solo se ajustaron los enlaces relativos para que apunten a `../testing/` desde esta carpeta y se bajó un nivel cada título.

#### Registro de defectos — TP4 Plan de Pruebas

Defectos que encontraron las pruebas durante la ejecución del 21/10/2026, en la rama `tp4-plan-pruebas`. Cada defecto se registró antes de corregirse: el commit `3ba285a` contiene las pruebas en rojo y cada corrección tiene un commit propio que la referencia. La salida de cada prueba antes y después de la corrección está en [`evidencias/`](../testing/evidencias/).

| ID | Componente | Prueba que lo detectó | Severidad | Estado | Commit de la corrección |
|---|---|---|---|---|---|
| DEF-01 | chat-controller | PT-CU05-20 | Media | Corregido | `9727b91` |
| DEF-02 | cache-controller | PT-TR-35 | Baja | Corregido | `0ee56db` |
| DEF-03 | scrapper | PT-TR-24 | Media | Corregido | `9347ad4` |
| DEF-04 | frontend (nginx) | PT-TR-71, PT-TR-72 (ZAP) | Media | Corregido | `f5f74d3` |

Criterio de severidad: **Alta**, pérdida de datos o falla de seguridad explotable en el flujo principal; **Media**, pérdida o degradación en condiciones de falla de otro componente, o un RNF incumplido; **Baja**, comportamiento incorrecto sin impacto visible hoy en el producto.

---

##### DEF-01 — Los mensajes del chat quedan sin persistir si falla un PushBatch

- **Componente:** `src/chat-controller/src/cache-client.js` (`flush`)
- **Detectado por:** PT-CU05-20 (Vitest, fake timers)
- **Qué falló:** se simuló un `PushBatch` que falla una vez y se avanzó el reloj 3 s. Se esperaba un segundo intento, pero `pushBatch` se llamó **1 vez en lugar de 2** (`expected "pushBatch" to be called 2 times, but got 1 times`). Los mensajes quedaban en el buffer y solo se reintentaban si alguien volvía a escribir en esa sala o al apagar el proceso con `flushAll`.
- **Impacto:** si el cache-controller tiene una caída breve, los mensajes de ese momento no llegan a Redis. Quien entra a la sala después no los ve en el historial, y si el contenedor muere (SIGKILL, OOM) se pierden.
- **Causa:** `flush()` borra el timer de la sala antes de llamar a `pushBatch`. En el `catch` devolvía los mensajes al buffer (`buffer.unshift`) pero no programaba un timer nuevo.
- **Corrección:** se extrajo `scheduleFlush(key)` y se llama también desde el `catch`. Mientras la caché no responda, el lote se reintenta cada 3 s.
- **Evidencia:** [`DEF-01-antes.txt`](../testing/evidencias/DEF-01-antes.txt), [`DEF-01-despues.txt`](../testing/evidencias/DEF-01-despues.txt)
- **Commit:** `9727b91` — fix(chat): reprogramar el flush cuando PushBatch falla (DEF-01)

##### DEF-02 — `GetTTL` devuelve 0 para claves sin vencimiento o inexistentes

- **Componente:** `src/cache-controller/server.go` (`GetTTL`)
- **Detectado por:** PT-TR-35 (go test + Testify + miniredis)
- **Qué falló:** para una clave persistente se esperaba `-1` y para una inexistente `-2`, que es la semántica de Redis. En los dos casos se obtuvo `0`.
- **Impacto:** un cliente no puede distinguir "no vence" ni "no existe" de "vence en menos de un segundo". Hoy ningún servicio de LumInsieme usa `GetTTL` (solo la TUI de diagnóstico), por eso la severidad es baja. Igual es un contrato gRPC incorrecto.
- **Causa:** go-redis devuelve los valores especiales `-1`/`-2` como `time.Duration` crudo, es decir -1 ns y -2 ns, no segundos. `int64(ttl.Seconds())` los truncaba a 0.
- **Corrección:** si `ttl < 0` se devuelve `int64(ttl)` sin convertir.
- **Evidencia:** [`DEF-02-antes.txt`](../testing/evidencias/DEF-02-antes.txt), [`DEF-02-despues.txt`](../testing/evidencias/DEF-02-despues.txt)
- **Commit:** `0ee56db` — fix(cache): GetTTL devuelve -1/-2 para claves sin vencimiento o inexistentes (DEF-02)

##### DEF-03 — Si Chromium no arranca, el scrapper termina con un `AttributeError` que tapa el error real

- **Componente:** `src/scrapper/models/browserController.py` (`start`/`close`), invocado desde `main.py`
- **Detectado por:** PT-TR-24 (pytest, `start()` simulado para que falle)
- **Qué falló:** se esperaba que `run_initial_scrape()` informara el error y cerrara el cliente gRPC. En cambio, el `finally` llamaba a `controller.close()`, que lanzaba `AttributeError: 'PlaywrightBrowserController' object has no attribute 'context'`.
- **Impacto:** el contenedor `scrapper` terminaba con traceback y código de salida 1, la causa real (por ejemplo, Chromium no instalado) quedaba enterrada en el log y el canal gRPC no se cerraba.
- **Causa:** `start()` guardaba el navegador en `self.browser`/`self.context`, pero la clase declara `_browser`/`_context`. Si `start()` fallaba, esos atributos no existían. Además, por la misma confusión de nombres, `is_running()` devolvía siempre `False`.
- **Corrección:** `start()`, `_new_page()` y `close()` usan los atributos declarados `_browser`/`_context`, y `close()` solo cierra lo que efectivamente se abrió. PT-TR-16 se amplió para verificar `is_running()`.
- **Evidencia:** [`DEF-03-antes.txt`](../testing/evidencias/DEF-03-antes.txt), [`DEF-03-despues.txt`](../testing/evidencias/DEF-03-despues.txt)
- **Commit:** `9347ad4` — fix(scrapper): close() del navegador tolera un start() fallido (DEF-03)

##### DEF-04 — El frontend no envía cabeceras de seguridad y expone versiones del servidor

- **Componente:** `src/frontend/nginx.conf`
- **Detectado por:** OWASP ZAP baseline (PT-TR-71, PT-TR-72)
- **Qué falló:** el primer baseline reportó 3 alertas de riesgo medio y 8 de riesgo bajo: falta de Content-Security-Policy (10038), de protección anti-clickjacking (10020), de X-Content-Type-Options (10021), de Strict-Transport-Security (10035), de Permissions-Policy (10063) y de cabeceras Cross-Origin (90004); además, la versión de nginx en `Server` (10036) y `X-Powered-By: Express` en las respuestas de la API (10037). Reporte completo: [`reportes/zap/antes-zap-baseline.html`](../testing/reportes/zap/antes-zap-baseline.html).
- **Impacto:** incumple el RNF de Seguridad. Sin CSP ni `frame-ancestors` la app queda expuesta a clickjacking y a que un XSS cargue scripts externos, y la versión expuesta del servidor facilita buscar CVE conocidos.
- **Causa:** `nginx.conf` solo configuraba TLS y los proxies, sin `add_header` de seguridad ni `server_tokens off`.
- **Corrección:** se agregaron CSP (`default-src 'self'`, solo Google Fonts como origen externo, `frame-ancestors 'none'`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP, `server_tokens off`, `proxy_hide_header X-Powered-By` y `Cache-Control: no-store` para `/auth` y `/salas` (datos personales). HSTS se envía para cualquier host salvo `localhost`/`127.0.0.1`, porque el navegador lo aplicaría también a `http://localhost:5173` y rompería el modo desarrollo con Vite.
- **Verificación:** nuevo baseline sin las alertas 10038/10020/10021/10035/10063/10036/10037 ([`reportes/zap/zap-baseline.html`](../testing/reportes/zap/zap-baseline.html)). La prueba E2E PT-TR-57 recorre feed, crear sala y chat sin violaciones de CSP en Chromium ni en WebKit, y las 16 ejecuciones E2E siguen en verde.
- **Riesgo aceptado (no corregido):** SRI en la hoja de Google Fonts (90003, medio), porque Google sirve un CSS distinto según el navegador y no admite hash fijo; para eliminarlo habría que servir las fuentes desde el propio dominio. COEP (90004, bajo), porque `require-corp` bloquearía las fuentes de Google.
- **Commit:** `f5f74d3` — fix(frontend): cabeceras de seguridad en nginx (DEF-04)

---

##### Observaciones (no son defectos)

| ID | Origen | Observación | Recomendación |
|---|---|---|---|
| OBS-01 | k6 PT-TR-63/64 | `POST /salas/:id/chat-ticket` con 60 pedidos simultáneos en frío llegó a p95 = 256 ms. En ráfagas siguientes se estabiliza en ~100 ms. El tiempo es de espera del servidor: 60 consultas compiten por un pool de 10 conexiones a Postgres. Este endpoint no está alcanzado por el RNF de < 200 ms (que aplica a consultas a la caché). | Si se espera ese patrón de entrada, subir `max` del pool o resolver la membresía con una consulta más liviana que `findById`. |
| OBS-02 | ZAP 10024 (informativa) | El ticket del chat viaja en la query string del WebSocket (`/ws/chat?ticket=…`) y puede quedar en logs de acceso. Vence a los 5 minutos y solo sirve para el chat de esa sala. | Excluir la query de `/ws/` del `log_format` de nginx. |
| OBS-03 | Revisión de código (sin prueba automatizada) | El chat-controller valida la membresía solo al conectar (el ticket). Quien sale de la sala sigue recibiendo y enviando mensajes hasta que se cierre su WebSocket. PT-CU06-04 confirma que no puede pedir un ticket nuevo. | Que reunion-controller notifique la baja al chat (por Pub/Sub del cache-controller) para cerrar ese socket. |
| OBS-04 | Revisión de código (scrapper) | `SCRAPPING_DAYS` no se usa (la estrategia fija 5 días), `utils/config.py` falla al importarse sin las variables de entorno y el bloque `__main__` de `browserController.py` llama a `run()` sin instancia. | Ninguno afecta al contenedor actual; conviene limpiarlos. |
| OBS-05 | Criterio de "sala vencida" | Una sala se considera vencida cuando su fecha es anterior a hoy (zona `America/Argentina/Buenos_Aires`). Una sala de hoy cuya hora ya pasó sigue en el feed y admite altas. Las pruebas PT-CU03-04 y PT-CU04-05 verifican ese criterio. | Definir si también debe cerrarse por hora. |
| OBS-06 | Higiene del repositorio | `src/login-controller/node_modules` está versionado (1185 archivos) y los `.go` tienen finales de línea CRLF, por lo que `gofmt -l` los marca a todos. | Quitar `node_modules` del índice y agregar un `.gitattributes` con `*.go text eol=lf`. |

Durante la escritura de las pruebas hubo además 2 fallos que fueron **errores de la propia prueba** y no del producto, corregidos en la prueba: PT-CU03-29 buscaba un texto que también aparece en el póster de la tarjeta, y PT-CU02-19 no completaba los campos `required` que el navegador valida antes del chequeo de película. Por otro lado, jsdom 30 no corre sobre Node 22.13 (usa `zlib` zstd), así que se fijó jsdom 26.1.0.
