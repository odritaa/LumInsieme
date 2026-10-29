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

{{COMMITS}}

Totales:

{{COMMITS_TOTALES}}

Por autor, tal como figura en git. No se unificaron identidades, pero varias corresponden a la misma persona con distinto nombre o cuenta: "Tomy Varas", "TomyVarasOviedo" y "Tomás Varas Oviedo"; "Diego-Escorche" y "Diego Escorche". Los commits del TP4 figuran como "Diego-Escorche" porque es el `user.name` configurado en este equipo.

{{AUTORES}}

### A2. Ramas y tags

{{RAMAS}}

- **Tags y releases:** ninguno, ni locales ni en GitHub (`git tag` vacío; `/tags`, `/releases` y `/rulesets` devuelven `[]`).
- **Ramas desalineadas:**
  - `main` local está 2 commits atrás de `origin/main` (no se hizo pull).
  - Las ramas remotas `origin/cache-chat`, `origin/cache-controller`, `origin/cache-scrapper` y `origin/scrapper` no tienen rama local.
  - `tp4-plan-pruebas` no tiene contraparte remota.

### A3. Pull requests

Equivalente a `gh pr list --state all --limit 200 --json number,title,author,createdAt,mergedAt,headRefName,baseRefName,reviews,reviewDecision,additions,deletions,changedFiles`, más commits y comentarios. Hay 3 PRs en total, los 3 mergeados.

{{PRS}}

- Los 3 PRs los mergeó su propio autor (`merged_by` = autor), sin aprobación de otra persona. La única review (PR #1) es un `COMMENTED` del mismo autor.
- El PR #2 suma +986 681 líneas en 4109 archivos: incluye `node_modules` y otros artefactos (ver B5).
- De los 50 commits de `origin/main`, 23 llegaron por PR: 20 commits de las ramas (1 + 3 + 16) más los 3 merges de PR. Los otros 27, incluidos 7 merges que no son de PR, llegaron por push o merge directo.

### A4. Evolución de la documentación

Todos los `.md` versionados en cualquier ref (README, AGENTES.md, minutas y documentos de `docs/`), sin contar `node_modules`. "Commits que lo tocan" incluye el de creación; "Modificaciones" = commits − 1. "Commits en main" cuenta solo la historia de `origin/main`. No se siguen renombres (`--follow`).

{{DOCS}}

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

{{REGRESION_TOTALES}}

Diferencias contra el 21/10. Son todas las pruebas cuyo resultado cambió; no hay pruebas nuevas ni faltantes.

{{REGRESION_DIFERENCIAS}}

- Siete de las ocho diferencias son las comprobaciones de DEF-01 a DEF-04, que fallan porque sus correcciones están solo en `tp4-plan-pruebas`. PT-TR-16 es la aserción sobre `is_running()` que se agregó con la corrección de DEF-03.
- **PT-TR-64** falla por la primera ráfaga en frío: 221 ms contra el umbral de 200. Es el fenómeno de OBS-01. El backend de `main` es idéntico al del 21/10 (los commits nuevos solo tocan el frontend), y el control con el código del 21/10, en la misma sesión, dio 173 ms en esa ráfaga.
- Los cambios de `main` posteriores al TP4 (`7afec48`, polling de feed, sala y chat) **no rompieron ninguna prueba**: el frontend pasa 34/34 y el E2E 14/16 (las 2 fallas son PT-TR-57 por DEF-04).

Métricas de k6, mismas condiciones de energía que el control (equipo enchufado):

{{REGRESION_K6}}

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

{{CARGA_MAIN}}

**Control: código del 21/10 (`tp4-plan-pruebas`), misma sesión y equipo enchufado:**

{{CARGA_CONTROL}}

**`main` a batería (descartada, solo como referencia):**

{{CARGA_BATERIA}}

Datos complementarios:

- **Contra el RNF:** sin throttling, todas las cargas quedan por debajo de 1 s (peor caso: 940 ms, primera carga en frío del login). Con Slow 4G + CPU 4× y **sin caché**, ninguna página llega a usable en menos de 2 s: mediana de 2,55 s en el login y 2,80 s en el feed. Con caché sí: 0,77 s y 1,08 s.
- **Peso del bundle:** el JS (`index-B7P1yJnB.js`) pesa 268 136 bytes y el CSS 27 401, y **nginx los sirve sin compresión** (sin `Content-Encoding`; la imagen oficial trae `gzip` apagado). Con gzip nivel 6 bajarían a 83 886 y 5 690 bytes; con brotli, a 72 869 y 5 043.
- **Caché de assets:** nginx no envía `Cache-Control` ni `Expires` para `/assets/` (solo `Last-Modified` y `ETag`). La reutilización observada depende de la heurística del navegador.
- **Cascada con caché bajo throttling** (`/feed`, una corrida, todo servido desde caché): el HTML a los 0–3 ms, el JS entre 1122 y 1126 ms, `/auth/me` entre 4066 y 4266 ms, y recién después `/salas` y `/cartelera` (de 6216 a 6460 ms). La espera es de CPU (parseo y ejecución del JS) y la app no pide los datos hasta que `/auth/me` responde. Esa cascada se tomó durante la tanda a batería.
- **Costo del `no-store` de DEF-04:** con caché, el feed del control transfiere 20,5 KB y el de `main` 0,8 KB. La diferencia son las respuestas de `/auth` y `/salas`, que el control vuelve a bajar completas en cada visita.

### B3. Análisis estático (sin corregir)

oxlint 1.74.0 sobre `src/` de cada paquete. El frontend usa su `.oxlintrc.json`; los servicios Node no tienen configuración propia y corren con las reglas por defecto (categoría *correctness*).

{{OXLINT}}

Go (`go vet`, staticcheck) y Python (ruff):

{{GO_PY}}

Resumen por severidad: oxlint 0 errores y 1 warning; go vet 0; staticcheck 1 (SA1019, `severity: error` según staticcheck); ruff 3 (F401), de los cuales 1 está en código gRPC generado (`pb/`).

### B4. Vulnerabilidades de dependencias

**npm audit** sobre los `package-lock.json` de `origin/main` (sin las dependencias de prueba del TP4):

{{NPM_TOTALES}}

{{NPM_DETALLE}}

**pip-audit** sobre `src/scrapper/requirements.txt` de `main` (12 paquetes resueltos). pip-audit no informa severidad; se toma la de GitHub Advisory:

{{PIP}}

**govulncheck** sobre `src/cache-controller` (`./...`, base de datos vuln.go.dev al 27/10). govulncheck no asigna severidad: clasifica por alcance. Se agrega la severidad de GitHub Advisory donde el aviso tiene ID GHSA; los avisos de la stdlib de Go no lo tienen y quedan como n/d.

{{GOVULN_TOTALES}}

{{GOVULN}}

Los 14 avisos de la stdlib corresponden al toolchain con que se compila la imagen (`golang:1.25` → go1.25.14). Los de `google.golang.org/grpc` y `golang.org/x/net` corresponden a versiones fijadas en `go.mod`.

### B5. Higiene del repositorio

**gitleaks detect** sobre la historia de todas las refs (`--log-opts=--all`, salida redactada): 45 commits con diff escaneados, 53,7 MB, **2 hallazgos**.

{{GITLEAKS}}

- Los dos están en copias guardadas del HTML **público** de multiplex.com.ar: una `data-sitekey` de reCAPTCHA, que es pública por diseño, y un `token` embebido en la página. **No son secretos del proyecto.**
- **Ningún `.env` real se commiteó nunca:** en la historia completa solo aparecen `.env.example`, y sus claves sensibles (`POSTGRES_PASSWORD`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) están vacías.
- Ni `tests/stack/test.env` ni `fixtures.local.json` del TP4 figuran en la historia.

**Artefactos generados versionados en `origin/main`** (1372 archivos, 51,07 MB en total):

{{ARTEFACTOS}}

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

{{DEFECTOS_MD}}
