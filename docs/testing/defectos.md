# Registro de defectos — TP4 Plan de Pruebas

Defectos que encontraron las pruebas durante la ejecución del 21/10/2026, en la rama `tp4-plan-pruebas`. Cada defecto se registró antes de corregirse: el commit `3ba285a` contiene las pruebas en rojo y cada corrección tiene un commit propio que la referencia. La salida de cada prueba antes y después de la corrección está en [`evidencias/`](evidencias/).

| ID | Componente | Prueba que lo detectó | Severidad | Estado | Commit de la corrección |
|---|---|---|---|---|---|
| DEF-01 | chat-controller | PT-CU05-20 | Media | Corregido | `9727b91` |
| DEF-02 | cache-controller | PT-TR-35 | Baja | Corregido | `0ee56db` |
| DEF-03 | scrapper | PT-TR-24 | Media | Corregido | `9347ad4` |
| DEF-04 | frontend (nginx) | PT-TR-71, PT-TR-72 (ZAP) | Media | Corregido | `f5f74d3` |

Criterio de severidad: **Alta**, pérdida de datos o falla de seguridad explotable en el flujo principal; **Media**, pérdida o degradación en condiciones de falla de otro componente, o un RNF incumplido; **Baja**, comportamiento incorrecto sin impacto visible hoy en el producto.

---

## DEF-01 — Los mensajes del chat quedan sin persistir si falla un PushBatch

- **Componente:** `src/chat-controller/src/cache-client.js` (`flush`)
- **Detectado por:** PT-CU05-20 (Vitest, fake timers)
- **Qué falló:** se simuló un `PushBatch` que falla una vez y se avanzó el reloj 3 s. Se esperaba un segundo intento, pero `pushBatch` se llamó **1 vez en lugar de 2** (`expected "pushBatch" to be called 2 times, but got 1 times`). Los mensajes quedaban en el buffer y solo se reintentaban si alguien volvía a escribir en esa sala o al apagar el proceso con `flushAll`.
- **Impacto:** si el cache-controller tiene una caída breve, los mensajes de ese momento no llegan a Redis. Quien entra a la sala después no los ve en el historial, y si el contenedor muere (SIGKILL, OOM) se pierden.
- **Causa:** `flush()` borra el timer de la sala antes de llamar a `pushBatch`. En el `catch` devolvía los mensajes al buffer (`buffer.unshift`) pero no programaba un timer nuevo.
- **Corrección:** se extrajo `scheduleFlush(key)` y se llama también desde el `catch`. Mientras la caché no responda, el lote se reintenta cada 3 s.
- **Evidencia:** [`DEF-01-antes.txt`](evidencias/DEF-01-antes.txt), [`DEF-01-despues.txt`](evidencias/DEF-01-despues.txt)
- **Commit:** `9727b91` — fix(chat): reprogramar el flush cuando PushBatch falla (DEF-01)

## DEF-02 — `GetTTL` devuelve 0 para claves sin vencimiento o inexistentes

- **Componente:** `src/cache-controller/server.go` (`GetTTL`)
- **Detectado por:** PT-TR-35 (go test + Testify + miniredis)
- **Qué falló:** para una clave persistente se esperaba `-1` y para una inexistente `-2`, que es la semántica de Redis. En los dos casos se obtuvo `0`.
- **Impacto:** un cliente no puede distinguir "no vence" ni "no existe" de "vence en menos de un segundo". Hoy ningún servicio de LumInsieme usa `GetTTL` (solo la TUI de diagnóstico), por eso la severidad es baja. Igual es un contrato gRPC incorrecto.
- **Causa:** go-redis devuelve los valores especiales `-1`/`-2` como `time.Duration` crudo, es decir -1 ns y -2 ns, no segundos. `int64(ttl.Seconds())` los truncaba a 0.
- **Corrección:** si `ttl < 0` se devuelve `int64(ttl)` sin convertir.
- **Evidencia:** [`DEF-02-antes.txt`](evidencias/DEF-02-antes.txt), [`DEF-02-despues.txt`](evidencias/DEF-02-despues.txt)
- **Commit:** `0ee56db` — fix(cache): GetTTL devuelve -1/-2 para claves sin vencimiento o inexistentes (DEF-02)

## DEF-03 — Si Chromium no arranca, el scrapper termina con un `AttributeError` que tapa el error real

- **Componente:** `src/scrapper/models/browserController.py` (`start`/`close`), invocado desde `main.py`
- **Detectado por:** PT-TR-24 (pytest, `start()` simulado para que falle)
- **Qué falló:** se esperaba que `run_initial_scrape()` informara el error y cerrara el cliente gRPC. En cambio, el `finally` llamaba a `controller.close()`, que lanzaba `AttributeError: 'PlaywrightBrowserController' object has no attribute 'context'`.
- **Impacto:** el contenedor `scrapper` terminaba con traceback y código de salida 1, la causa real (por ejemplo, Chromium no instalado) quedaba enterrada en el log y el canal gRPC no se cerraba.
- **Causa:** `start()` guardaba el navegador en `self.browser`/`self.context`, pero la clase declara `_browser`/`_context`. Si `start()` fallaba, esos atributos no existían. Además, por la misma confusión de nombres, `is_running()` devolvía siempre `False`.
- **Corrección:** `start()`, `_new_page()` y `close()` usan los atributos declarados `_browser`/`_context`, y `close()` solo cierra lo que efectivamente se abrió. PT-TR-16 se amplió para verificar `is_running()`.
- **Evidencia:** [`DEF-03-antes.txt`](evidencias/DEF-03-antes.txt), [`DEF-03-despues.txt`](evidencias/DEF-03-despues.txt)
- **Commit:** `9347ad4` — fix(scrapper): close() del navegador tolera un start() fallido (DEF-03)

## DEF-04 — El frontend no envía cabeceras de seguridad y expone versiones del servidor

- **Componente:** `src/frontend/nginx.conf`
- **Detectado por:** OWASP ZAP baseline (PT-TR-71, PT-TR-72)
- **Qué falló:** el primer baseline reportó 3 alertas de riesgo medio y 8 de riesgo bajo: falta de Content-Security-Policy (10038), de protección anti-clickjacking (10020), de X-Content-Type-Options (10021), de Strict-Transport-Security (10035), de Permissions-Policy (10063) y de cabeceras Cross-Origin (90004); además, la versión de nginx en `Server` (10036) y `X-Powered-By: Express` en las respuestas de la API (10037). Reporte completo: [`reportes/zap/antes-zap-baseline.html`](reportes/zap/antes-zap-baseline.html).
- **Impacto:** incumple el RNF de Seguridad. Sin CSP ni `frame-ancestors` la app queda expuesta a clickjacking y a que un XSS cargue scripts externos, y la versión expuesta del servidor facilita buscar CVE conocidos.
- **Causa:** `nginx.conf` solo configuraba TLS y los proxies, sin `add_header` de seguridad ni `server_tokens off`.
- **Corrección:** se agregaron CSP (`default-src 'self'`, solo Google Fonts como origen externo, `frame-ancestors 'none'`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP, `server_tokens off`, `proxy_hide_header X-Powered-By` y `Cache-Control: no-store` para `/auth` y `/salas` (datos personales). HSTS se envía para cualquier host salvo `localhost`/`127.0.0.1`, porque el navegador lo aplicaría también a `http://localhost:5173` y rompería el modo desarrollo con Vite.
- **Verificación:** nuevo baseline sin las alertas 10038/10020/10021/10035/10063/10036/10037 ([`reportes/zap/zap-baseline.html`](reportes/zap/zap-baseline.html)). La prueba E2E PT-TR-57 recorre feed, crear sala y chat sin violaciones de CSP en Chromium ni en WebKit, y las 16 ejecuciones E2E siguen en verde.
- **Riesgo aceptado (no corregido):** SRI en la hoja de Google Fonts (90003, medio), porque Google sirve un CSS distinto según el navegador y no admite hash fijo; para eliminarlo habría que servir las fuentes desde el propio dominio. COEP (90004, bajo), porque `require-corp` bloquearía las fuentes de Google.
- **Commit:** `f5f74d3` — fix(frontend): cabeceras de seguridad en nginx (DEF-04)

---

## Observaciones (no son defectos)

| ID | Origen | Observación | Recomendación |
|---|---|---|---|
| OBS-01 | k6 PT-TR-63/64 | `POST /salas/:id/chat-ticket` con 60 pedidos simultáneos en frío llegó a p95 = 256 ms. En ráfagas siguientes se estabiliza en ~100 ms. El tiempo es de espera del servidor: 60 consultas compiten por un pool de 10 conexiones a Postgres. Este endpoint no está alcanzado por el RNF de < 200 ms (que aplica a consultas a la caché). | Si se espera ese patrón de entrada, subir `max` del pool o resolver la membresía con una consulta más liviana que `findById`. |
| OBS-02 | ZAP 10024 (informativa) | El ticket del chat viaja en la query string del WebSocket (`/ws/chat?ticket=…`) y puede quedar en logs de acceso. Vence a los 5 minutos y solo sirve para el chat de esa sala. | Excluir la query de `/ws/` del `log_format` de nginx. |
| OBS-03 | Revisión de código (sin prueba automatizada) | El chat-controller valida la membresía solo al conectar (el ticket). Quien sale de la sala sigue recibiendo y enviando mensajes hasta que se cierre su WebSocket. PT-CU06-04 confirma que no puede pedir un ticket nuevo. | Que reunion-controller notifique la baja al chat (por Pub/Sub del cache-controller) para cerrar ese socket. |
| OBS-04 | Revisión de código (scrapper) | `SCRAPPING_DAYS` no se usa (la estrategia fija 5 días), `utils/config.py` falla al importarse sin las variables de entorno y el bloque `__main__` de `browserController.py` llama a `run()` sin instancia. | Ninguno afecta al contenedor actual; conviene limpiarlos. |
| OBS-05 | Criterio de "sala vencida" | Una sala se considera vencida cuando su fecha es anterior a hoy (zona `America/Argentina/Buenos_Aires`). Una sala de hoy cuya hora ya pasó sigue en el feed y admite altas. Las pruebas PT-CU03-04 y PT-CU04-05 verifican ese criterio. | Definir si también debe cerrarse por hora. |
| OBS-06 | Higiene del repositorio | `src/login-controller/node_modules` está versionado (1185 archivos) y los `.go` tienen finales de línea CRLF, por lo que `gofmt -l` los marca a todos. | Quitar `node_modules` del índice y agregar un `.gitattributes` con `*.go text eol=lf`. |

Durante la escritura de las pruebas hubo además 2 fallos que fueron **errores de la propia prueba** y no del producto, corregidos en la prueba: PT-CU03-29 buscaba un texto que también aparece en el póster de la tarjeta, y PT-CU02-19 no completaba los campos `required` que el navegador valida antes del chequeo de película. Por otro lado, jsdom 30 no corre sobre Node 22.13 (usa `zlib` zstd), así que se fijó jsdom 26.1.0.
