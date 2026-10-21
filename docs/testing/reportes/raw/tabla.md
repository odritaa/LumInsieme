| ID | CU | Nivel | Herramienta | Descripción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| PT-CU01-01 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /auth/me sin cookie | 401 unauthenticated | Igual al esperado | ✅ Pasó |
| PT-CU01-02 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /auth/me con JWT válido en cookie | 200 con el perfil (sin googleSub) | Igual al esperado | ✅ Pasó |
| PT-CU01-03 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /auth/me con JWT válido por Authorization: Bearer | 200 | Igual al esperado | ✅ Pasó |
| PT-CU01-04 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /auth/me con JWT vencido | 401 invalid_token | Igual al esperado | ✅ Pasó |
| PT-CU01-05 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /auth/me con JWT firmado con otro secreto | 401 invalid_token | Igual al esperado | ✅ Pasó |
| PT-CU01-06 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /auth/me con JWT alg=none (sin firma) | 401 | Igual al esperado | ✅ Pasó |
| PT-CU01-07 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /auth/me con JWT alg=HS512 (mismo secreto) | 401 | Igual al esperado | ✅ Pasó |
| PT-CU01-08 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | Ticket de chat (otro iss/aud) usado como sesión | 401 | Igual al esperado | ✅ Pasó |
| PT-CU01-09 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | JWT válido de un usuario borrado | 401 y cookie expirada | Igual al esperado | ✅ Pasó |
| PT-CU01-10 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /auth/google | 302 a Google con state y cookie de state HttpOnly en /auth | Igual al esperado | ✅ Pasó |
| PT-CU01-11 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | Callback con state distinto al de la cookie | redirect /?error=invalid_state sin sesión | Igual al esperado | ✅ Pasó |
| PT-CU01-12 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | Callback sin cookie de state | redirect /?error=invalid_state | Igual al esperado | ✅ Pasó |
| PT-CU01-13 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | Callback con error de Google (usuario cancela) | redirect /?error=access_denied | Igual al esperado | ✅ Pasó |
| PT-CU01-14 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | Callback válido (token endpoint simulado) | usuario creado, cookie de sesión y redirect /feed | Igual al esperado | ✅ Pasó |
| PT-CU01-15 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | Callback con fallo del token endpoint | redirect /?error=oauth_failed | Igual al esperado | ✅ Pasó |
| PT-CU01-16 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | PATCH /auth/me con edad menor a 13 | 400 invalid_profile | Igual al esperado | ✅ Pasó |
| PT-CU01-17 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | PATCH /auth/me con edad mayor a 120 | 400 invalid_profile | Igual al esperado | ✅ Pasó |
| PT-CU01-18 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | PATCH /auth/me con edad como texto | 400 invalid_profile | Igual al esperado | ✅ Pasó |
| PT-CU01-19 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | PATCH /auth/me con géneros fuera de la lista blanca | 400 invalid_profile | Igual al esperado | ✅ Pasó |
| PT-CU01-20 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | PATCH /auth/me con 6 películas favoritas | 400 invalid_profile | Igual al esperado | ✅ Pasó |
| PT-CU01-21 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | PATCH /auth/me sin campos editables | 400 | Igual al esperado | ✅ Pasó |
| PT-CU01-22 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | PATCH /auth/me válido | 200, perfil persistido y géneros deduplicados | Igual al esperado | ✅ Pasó |
| PT-CU01-23 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | PATCH /auth/me sin sesión | 401 | Igual al esperado | ✅ Pasó |
| PT-CU01-24 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | POST /auth/logout | 204 y cookie lum_session expirada | Igual al esperado | ✅ Pasó |
| PT-CU01-25 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | DELETE /auth/me | 204 y usuario eliminado | Igual al esperado | ✅ Pasó |
| PT-CU01-26 | CU-01 | Integración (API + Postgres) | Vitest + Supertest | GET /health con la base disponible | 200 {status: ok, db: ok} | Igual al esperado | ✅ Pasó |
| PT-CU01-27 | CU-01 | Unitaria | Vitest + Supertest | decodeIdToken con id_token válido | perfil normalizado | Igual al esperado | ✅ Pasó |
| PT-CU01-28 | CU-01 | Unitaria | Vitest + Supertest | decodeIdToken con emisor ajeno | error | Igual al esperado | ✅ Pasó |
| PT-CU01-29 | CU-01 | Unitaria | Vitest + Supertest | decodeIdToken con audiencia de otro cliente | error | Igual al esperado | ✅ Pasó |
| PT-CU01-30 | CU-01 | Unitaria | Vitest + Supertest | decodeIdToken con vencido | error | Igual al esperado | ✅ Pasó |
| PT-CU01-31 | CU-01 | Unitaria | Vitest + Supertest | decodeIdToken con email no verificado | error | Igual al esperado | ✅ Pasó |
| PT-CU01-32 | CU-01 | Unitaria | Vitest + Supertest | decodeIdToken con token mal formado | error de formato | Igual al esperado | ✅ Pasó |
| PT-CU01-33 | CU-01 | Unitaria | Vitest + Supertest | buildAuthUrl | scope openid email profile, response_type code y state propagado | Igual al esperado | ✅ Pasó |
| PT-CU01-34 | CU-01 | Unitaria | Vitest + Supertest | sanitizeProfile con edad null, 14 géneros válidos y 5 películas | sin errores | Igual al esperado | ✅ Pasó |
| PT-CU01-35 | CU-01 | Unitaria | Vitest + Supertest | sanitizeProfile con arreglo, película sin título, nombre >80 o ciudad no texto | errores | Igual al esperado | ✅ Pasó |
| PT-CU01-36 | CU-01 | Integración (UI + API simulada) | Vitest + RTL | Sin sesión (/auth/me 401) una ruta interna | redirige al login | Igual al esperado | ✅ Pasó |
| PT-CU01-37 | CU-01 | Integración (UI + API simulada) | Vitest + RTL | Login con ?error=invalid_state | muestra 'La sesión de inicio expiró' | Igual al esperado | ✅ Pasó |
| PT-CU01-38 | CU-01 | Integración (UI + API simulada) | Vitest + RTL | Con sesión válida el login | redirige al feed | Igual al esperado | ✅ Pasó |
| PT-CU01-39 | CU-01 | Integración (UI + API simulada) | Vitest + RTL | Cerrar sesión desde el perfil | POST /auth/logout y vuelta al login | Igual al esperado | ✅ Pasó |
| PT-CU01-40 | CU-01 | Integración (UI + API simulada) | Vitest + RTL | Un 401 de /salas (JWT vencido) | la app cierra la sesión y vuelve al login | Igual al esperado | ✅ Pasó |
| PT-CU02-01 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con cupo 1 | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-02 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con cupo 7 | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-03 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con cupo no entero (3.5) | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-04 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con fecha pasada (ayer) | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-05 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con fecha inexistente (2026-02-30) | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-06 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con hora inválida (25:00) | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-07 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con hora sin formato HH:MM (8:5) | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-08 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con película de 121 caracteres | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-09 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con cine de 121 caracteres | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-10 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con nota de 501 caracteres | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-11 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con película vacía | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-12 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con un arreglo como cuerpo | 400 invalid_sala | Igual al esperado | ✅ Pasó |
| PT-CU02-13 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas sin sesión | 401 | Igual al esperado | ✅ Pasó |
| PT-CU02-14 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas válido | 201, el creador queda como miembro y anfitrión | Igual al esperado | ✅ Pasó |
| PT-CU02-15 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con cupo límite 2 | 201 | Igual al esperado | ✅ Pasó |
| PT-CU02-16 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con cupo límite 6 | 201 | Igual al esperado | ✅ Pasó |
| PT-CU02-17 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | POST /salas con fecha de hoy | 201 | Igual al esperado | ✅ Pasó |
| PT-CU02-18 | CU-02 | Integración (API + Postgres) | Vitest + Supertest | La sala no expone email de los miembros | solo id, name, genres, isAdmin | Igual al esperado | ✅ Pasó |
| PT-CU02-19 | CU-02 | Integración (UI + API simulada) | Vitest + RTL | Enviar el formulario con cine, fecha y hora pero sin película | 'Elegí una película para la sala.' sin llamar a la API | Igual al esperado | ✅ Pasó |
| PT-CU02-20 | CU-02 | Integración (UI + API simulada) | Vitest + RTL | Rechazo del backend (400 invalid_sala) | muestra los detalles de validación | Igual al esperado | ✅ Pasó |
| PT-CU02-21 | CU-02 | Integración (UI + API simulada) | Vitest + RTL | Formulario precargado desde la cartelera | POST /salas con los datos y navega a la sala | Igual al esperado | ✅ Pasó |
| PT-CU03-01 | CU-03 | Integración (API + Postgres) | Vitest + Supertest | GET /salas sin sesión | 401 unauthenticated | Igual al esperado | ✅ Pasó |
| PT-CU03-02 | CU-03 | Integración (API + Postgres) | Vitest + Supertest | GET /salas con JWT inválido | 401 invalid_token | Igual al esperado | ✅ Pasó |
| PT-CU03-03 | CU-03 | Integración (API + Postgres) | Vitest + Supertest | GET /salas | ordenado por created_at DESC (no por fecha de la función) | Igual al esperado | ✅ Pasó |
| PT-CU03-04 | CU-03 | Integración (API + Postgres) | Vitest + Supertest | GET /salas | oculta salas vencidas (fecha anterior a hoy) y muestra las de hoy | Igual al esperado | ✅ Pasó |
| PT-CU03-05 | CU-03 | Integración (API + Postgres) | Vitest + Supertest | GET /salas/:id con id mal formado | 404 sala_not_found | Igual al esperado | ✅ Pasó |
| PT-CU03-06 | CU-03 | Integración (API + Postgres) | Vitest + Supertest | GET /salas/:id inexistente | 404 sala_not_found | Igual al esperado | ✅ Pasó |
| PT-CU03-07 | CU-03 | Integración (API + Postgres) | Vitest + Supertest | GET /salas/:id existente | 200 con miembros | Igual al esperado | ✅ Pasó |
| PT-CU03-08 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | Formato actual del scrapper (días 'AAAA-M-D' sin ceros) | fechas normalizadas AAAA-MM-DD | Igual al esperado | ✅ Pasó |
| PT-CU03-09 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | Formato anterior del scrapper (lista plana con fecha ISO) | mismo resultado normalizado | Igual al esperado | ✅ Pasó |
| PT-CU03-10 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | Ambos formatos mezclados y una función repetida | cada función se lista una sola vez | Igual al esperado | ✅ Pasó |
| PT-CU03-11 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | Funciones ordenadas por hora, luego título y formato | — | Igual al esperado | ✅ Pasó |
| PT-CU03-12 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | Sin datos en caché (clave inexistente) | 200 con dates: [] y screenings: [] | Igual al esperado | ✅ Pasó |
| PT-CU03-13 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | Caché caída (gRPC UNAVAILABLE) | 503 cache_unavailable | Igual al esperado | ✅ Pasó |
| PT-CU03-14 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | scraped_data con JSON corrupto | 200 con dates: [] | Igual al esperado | ✅ Pasó |
| PT-CU03-15 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | Sin ?fecha | elige hoy o el próximo día con funciones (ignora días pasados) | Igual al esperado | ✅ Pasó |
| PT-CU03-16 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | ?fecha con formato inválido | 400 invalid_date | Igual al esperado | ✅ Pasó |
| PT-CU03-17 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | Películas sin título u horarios inválidos | se descartan | Igual al esperado | ✅ Pasó |
| PT-CU03-18 | CU-03 | Integración (API, caché simulada) | Vitest + Supertest | GET /cartelera/peliculas | catálogo plano normalizado | Igual al esperado | ✅ Pasó |
| PT-CU03-19 | CU-03 | Unitaria (componente) | Vitest + RTL | DaySelector sin fechas | no renderiza nada | Igual al esperado | ✅ Pasó |
| PT-CU03-20 | CU-03 | Unitaria (componente) | Vitest + RTL | DaySelector | chips 'Hoy', 'Mañana' y fecha corta para el resto | Igual al esperado | ✅ Pasó |
| PT-CU03-21 | CU-03 | Unitaria (componente) | Vitest + RTL | DaySelector | solo el día elegido tiene aria-selected=true | Igual al esperado | ✅ Pasó |
| PT-CU03-22 | CU-03 | Unitaria (componente) | Vitest + RTL | DaySelector al tocar un día | onSelect con la fecha AAAA-MM-DD | Igual al esperado | ✅ Pasó |
| PT-CU03-23 | CU-03 | Unitaria (componente) | Vitest + RTL | ScreeningTimeline de hoy | funciones ya iniciadas deshabilitadas con 'Empezó' | Igual al esperado | ✅ Pasó |
| PT-CU03-24 | CU-03 | Unitaria (componente) | Vitest + RTL | ScreeningTimeline de otro día | ninguna función deshabilitada | Igual al esperado | ✅ Pasó |
| PT-CU03-25 | CU-03 | Unitaria (componente) | Vitest + RTL | ScreeningTimeline | agrupa por franja horaria (HH:00) respetando el orden | Igual al esperado | ✅ Pasó |
| PT-CU03-26 | CU-03 | Unitaria (componente) | Vitest + RTL | Elegir una función futura | navega a /crear-sala con película, cine, fecha y hora precargados | Igual al esperado | ✅ Pasó |
| PT-CU03-27 | CU-03 | Integración (UI + API simulada) | Vitest + RTL | Cartelera sin datos (dates: []) | 'La cartelera todavía no está disponible' | Igual al esperado | ✅ Pasó |
| PT-CU03-28 | CU-03 | Integración (UI + API simulada) | Vitest + RTL | Cartelera con caché caída (503) | mensaje de error visible | Igual al esperado | ✅ Pasó |
| PT-CU03-29 | CU-03 | Integración (UI + API simulada) | Vitest + RTL | Pestaña 'Salas abiertas' | lista las salas en el orden recibido con contador | Igual al esperado | ✅ Pasó |
| PT-CU03-30 | CU-03 | Integración (UI + API simulada) | Vitest + RTL | Elegir un día del selector | pide /cartelera?fecha=AAAA-MM-DD | Igual al esperado | ✅ Pasó |
| PT-CU04-01 | CU-04 | Integración (API + Postgres) | Vitest + Supertest | POST /salas/:id/miembros | 200 y el usuario figura como miembro | Igual al esperado | ✅ Pasó |
| PT-CU04-02 | CU-04 | Integración (API + Postgres) | Vitest + Supertest | Unirse dos veces a la misma sala | 200 ambas, una sola membresía (idempotente) | Igual al esperado | ✅ Pasó |
| PT-CU04-03 | CU-04 | Integración (API + Postgres) | Vitest + Supertest | Unirse a una sala completa | 409 sala_full | Igual al esperado | ✅ Pasó |
| PT-CU04-04 | CU-04 | Integración (API + Postgres) | Vitest + Supertest | Un miembro de una sala completa vuelve a unirse | 200 (no 409) | Igual al esperado | ✅ Pasó |
| PT-CU04-05 | CU-04 | Integración (API + Postgres) | Vitest + Supertest | Unirse a una sala vencida | 409 sala_closed | Igual al esperado | ✅ Pasó |
| PT-CU04-06 | CU-04 | Integración (API + Postgres) | Vitest + Supertest | Unirse a una sala inexistente | 404 sala_not_found | Igual al esperado | ✅ Pasó |
| PT-CU04-07 | CU-04 | Integración (API + Postgres) | Vitest + Supertest | Dos altas concurrentes por el último lugar (20 repeticiones) | una 200 y una 409 sala_full | Igual al esperado | ✅ Pasó |
| PT-CU04-08 | CU-04 | Integración (API + Postgres) | Vitest + Supertest | Ocho altas concurrentes en una sala de cupo 6 | 5 aceptadas, 3 rechazadas, nunca sobrecupo | Igual al esperado | ✅ Pasó |
| PT-CU04-09 | CU-04 | Integración (UI + API simulada) | Vitest + RTL | 'Unirme a la Sala' | POST miembros y pasa a mostrar 'Salir de la Sala' | Igual al esperado | ✅ Pasó |
| PT-CU04-10 | CU-04 | Integración (UI + API simulada) | Vitest + RTL | Unirse a una sala que se llenó (409 sala_full) | 'La sala está completa.' | Igual al esperado | ✅ Pasó |
| PT-CU04-11 | CU-04 | Integración (UI + API simulada) | Vitest + RTL | Sala con cupo lleno | botón deshabilitado 'Sala completa' | Igual al esperado | ✅ Pasó |
| PT-CU04-12 | CU-04 | Unitaria (componente) | Vitest + RTL | joinSala con 409 sala_closed | error con mensaje 'La función de esta sala ya pasó.' y status 409 | Igual al esperado | ✅ Pasó |
| PT-CU05-01 | CU-05 | Integración (API + Postgres) | Vitest + Supertest | POST /salas/:id/chat-ticket de un no miembro | 403 not_a_member | Igual al esperado | ✅ Pasó |
| PT-CU05-02 | CU-05 | Integración (API + Postgres) | Vitest + Supertest | POST /salas/:id/chat-ticket de un miembro | 200 con ticket (aud luminsieme-chat, 5 min) | Igual al esperado | ✅ Pasó |
| PT-CU05-03 | CU-05 | Integración (API + Postgres) | Vitest + Supertest | POST /salas/:id/chat-ticket sin sesión | 401 | Igual al esperado | ✅ Pasó |
| PT-CU05-04 | CU-05 | Integración (WebSocket) | Vitest + Supertest | WebSocket con ticket inválido | cierre 4401 'invalid ticket' | Igual al esperado | ✅ Pasó |
| PT-CU05-05 | CU-05 | Integración (WebSocket) | Vitest + Supertest | WebSocket sin ticket | cierre 4401 | Igual al esperado | ✅ Pasó |
| PT-CU05-06 | CU-05 | Integración (WebSocket) | Vitest + Supertest | WebSocket con ticket firmado con otro secreto | cierre 4401 | Igual al esperado | ✅ Pasó |
| PT-CU05-07 | CU-05 | Integración (WebSocket) | Vitest + Supertest | WebSocket con ticket vencido | cierre 4401 | Igual al esperado | ✅ Pasó |
| PT-CU05-08 | CU-05 | Integración (WebSocket) | Vitest + Supertest | WebSocket con el JWT de sesión (aud luminsieme) en lugar del ticket | cierre 4401 | Igual al esperado | ✅ Pasó |
| PT-CU05-09 | CU-05 | Integración (WebSocket) | Vitest + Supertest | Al conectar | frame history con los últimos 50 mensajes de chat:<sala> | Igual al esperado | ✅ Pasó |
| PT-CU05-10 | CU-05 | Integración (WebSocket) | Vitest + Supertest | Caché caída al pedir historial | sin history, pero el socket sigue abierto y difunde | Igual al esperado | ✅ Pasó |
| PT-CU05-11 | CU-05 | Integración (WebSocket) | Vitest + Supertest | Mensaje de un miembro | broadcast a todos los miembros de la sala y a nadie más | Igual al esperado | ✅ Pasó |
| PT-CU05-12 | CU-05 | Integración (WebSocket) | Vitest + Supertest | La identidad sale del ticket: userId/username enviados por el cliente se ignoran | — | Igual al esperado | ✅ Pasó |
| PT-CU05-13 | CU-05 | Integración (WebSocket) | Vitest + Supertest | Mensaje vacío o solo espacios | descartado (sin broadcast ni persistencia) | Igual al esperado | ✅ Pasó |
| PT-CU05-14 | CU-05 | Integración (WebSocket) | Vitest + Supertest | Mensajes de 1001 y de 1000 caracteres | el de 1001 se descarta y el de 1000 se difunde | Igual al esperado | ✅ Pasó |
| PT-CU05-15 | CU-05 | Integración (WebSocket) | Vitest + Supertest | Frame que no es JSON | ignorado sin cerrar la conexión | Igual al esperado | ✅ Pasó |
| PT-CU05-16 | CU-05 | Unitaria (fake timers) | Vitest + Supertest | 9 mensajes no disparan PushBatch; el 10.º envía el lote completo (chat:<sala>, TTL 3 días) | — | Igual al esperado | ✅ Pasó |
| PT-CU05-17 | CU-05 | Unitaria (fake timers) | Vitest + Supertest | 3 mensajes sin completar el lote | PushBatch a los 3 s exactos (fake timers) | Igual al esperado | ✅ Pasó |
| PT-CU05-18 | CU-05 | Unitaria (fake timers) | Vitest + Supertest | Lote completo antes de los 3 s | cancela el timer (no hay PushBatch vacío ni duplicado) | Igual al esperado | ✅ Pasó |
| PT-CU05-19 | CU-05 | Unitaria (fake timers) | Vitest + Supertest | Buffers y timers independientes por sala | — | Igual al esperado | ✅ Pasó |
| PT-CU05-20 | CU-05 | Unitaria (fake timers) | Vitest + Supertest | PushBatch falla | los mensajes vuelven al buffer y se reintentan en el próximo intervalo de 3 s | 1.ª corrida: falló (DEF-01). Tras la corrección: igual al esperado | ✅ Pasó (tras DEF-01) |
| PT-CU05-21 | CU-05 | Unitaria (fake timers) | Vitest + Supertest | flushAll (apagado) persiste todos los buffers pendientes | — | Igual al esperado | ✅ Pasó |
| PT-CU05-22 | CU-05 | Integración (gRPC simulado) | Vitest + Supertest | pushBatch + range por gRPC | los mensajes se guardan y se leen en orden | Igual al esperado | ✅ Pasó |
| PT-CU05-23 | CU-05 | Integración (gRPC simulado) | Vitest + Supertest | health por gRPC | redis_connected true | Igual al esperado | ✅ Pasó |
| PT-CU05-24 | CU-05 | Integración (UI + API simulada) | Vitest + RTL | No miembro en la sala | chat deshabilitado con 'Unite a la sala para participar del chat' | Igual al esperado | ✅ Pasó |
| PT-CU05-25 | CU-05 | Unitaria (componente) | Vitest + RTL | useSalaChat | pide ticket, abre ws(s)://host/ws/chat?ticket=… y carga el history | Igual al esperado | ✅ Pasó |
| PT-CU05-26 | CU-05 | Unitaria (componente) | Vitest + RTL | useSalaChat con ticket rechazado (403) | estado 'error' sin reintentar | Igual al esperado | ✅ Pasó |
| PT-CU05-27 | CU-05 | Unitaria (componente) | Vitest + RTL | ChatPanel | no envía mensajes vacíos y limpia el borrador tras enviar | Igual al esperado | ✅ Pasó |
| PT-CU05-28 | CU-05 | Unitaria (componente) | Vitest + RTL | ChatPanel desconectado | 'Conectando…' y botón Enviar deshabilitado | Igual al esperado | ✅ Pasó |
| PT-CU06-01 | CU-06 | Integración (API + Postgres) | Vitest + Supertest | DELETE /salas/:id/miembros/me | 200 y el usuario deja de ser miembro | Igual al esperado | ✅ Pasó |
| PT-CU06-02 | CU-06 | Integración (API + Postgres) | Vitest + Supertest | El anfitrión abandona | la sala pasa al miembro más antiguo | Igual al esperado | ✅ Pasó |
| PT-CU06-03 | CU-06 | Integración (API + Postgres) | Vitest + Supertest | El último miembro abandona | sala eliminada ({sala: null} y luego 404) | Igual al esperado | ✅ Pasó |
| PT-CU06-04 | CU-06 | Integración (API + Postgres) | Vitest + Supertest | Ticket de chat pedido después de salir | 403 not_a_member | Igual al esperado | ✅ Pasó |
| PT-CU06-05 | CU-06 | Integración (API + Postgres) | Vitest + Supertest | Abandonar una sala inexistente | 404 sala_not_found | Igual al esperado | ✅ Pasó |
| PT-CU06-06 | CU-06 | Integración (API + Postgres) | Vitest + Supertest | Tras salir, el usuario puede volver a unirse si hay lugar | 200 | Igual al esperado | ✅ Pasó |
| PT-CU06-07 | CU-06 | Integración (UI + API simulada) | Vitest + RTL | Último miembro sale (respuesta {sala: null}) | vuelve a 'Salas abiertas' | Igual al esperado | ✅ Pasó |
| PT-CU06-08 | CU-06 | Unitaria (componente) | Vitest + RTL | leaveSala cuando la sala se elimina | devuelve null | Igual al esperado | ✅ Pasó |
| PT-TR-01 | Transversal | Integración (API, caché simulada) | Vitest + Supertest | GET /health con base OK y caché caída | 200 status degraded | Igual al esperado | ✅ Pasó |
| PT-TR-02 | Transversal | Integración (API, caché simulada) | Vitest + Supertest | GET /health con base y caché OK | 200 status ok | Igual al esperado | ✅ Pasó |
| PT-TR-03 | Transversal | Integración (WebSocket) | Vitest + Supertest | GET /health con Redis conectado | {status: ok, cache: ok} | Igual al esperado | ✅ Pasó |
| PT-TR-04 | Transversal | Integración (WebSocket) | Vitest + Supertest | GET /health con el cache-controller caído | {status: degraded, cache: error} | Igual al esperado | ✅ Pasó |
| PT-TR-05 | Transversal | Unitaria (componente) | Vitest + RTL | formatDate/formatDateTime | 'mar, 14 jul · 20:30 hs' sin corrimiento de día por UTC | Igual al esperado | ✅ Pasó |
| PT-TR-06 | Transversal | Unitaria (componente) | Vitest + RTL | formatMessageTime | solo hora si es de hoy; fecha y hora si no | Igual al esperado | ✅ Pasó |
| PT-TR-07 | Transversal | Unitaria (componente) | Vitest + RTL | posterLabel y getInitials | etiquetas cortas para pósters y avatares | Igual al esperado | ✅ Pasó |
| PT-TR-10 | Transversal | Integración (Chromium + fixture HTML) | pytest | doScrapping sobre el HTML de muestra | un dict por día con las películas visibles | Igual al esperado | ✅ Pasó |
| PT-TR-11 | Transversal | Integración (Chromium + fixture HTML) | pytest | extractScreenings | excluye horarios .horario-desactivado, ocultos y formatos no visibles | Igual al esperado | ✅ Pasó |
| PT-TR-12 | Transversal | Integración (Chromium + fixture HTML) | pytest | valor de día 'M.D.AAAA' | clave 'AAAA-M-D' y MovieData con fecha, cine y duración | Igual al esperado | ✅ Pasó |
| PT-TR-13 | Transversal | Integración (Chromium + fixture HTML) | pytest | página con 6 días disponibles | se scrapean solo los primeros 5 | Igual al esperado | ✅ Pasó |
| PT-TR-14 | Transversal | Integración (Chromium + fixture HTML) | pytest | HTML sin el popup esperado (cambio de estructura del sitio) | TimeoutError en vez de datos vacíos | Igual al esperado | ✅ Pasó |
| PT-TR-15 | Transversal | Integración (Chromium + fixture HTML) | pytest | HTML con un solo complejo de cines | TimeoutError | Igual al esperado | ✅ Pasó |
| PT-TR-16 | Transversal | Integración (Chromium + fixture HTML) | pytest | PlaywrightBrowserController.start + scrapper_page + close con Chromium real | resultado de la estrategia | Igual al esperado | ✅ Pasó |
| PT-TR-17 | Transversal | Unitaria | pytest | _serialize(MovieData) | dict con fecha AAAA-MM-DD y todos los campos que lee reunion-controller | Igual al esperado | ✅ Pasó |
| PT-TR-18 | Transversal | Unitaria | pytest | [{día: [MovieData]}] (salida de gather) | JSON válido que conserva acentos y la estructura por día | Igual al esperado | ✅ Pasó |
| PT-TR-19 | Transversal | Unitaria | pytest | _serialize de str/int/None | se devuelven sin cambios | Igual al esperado | ✅ Pasó |
| PT-TR-20 | Transversal | Unitaria | pytest | repr(MovieData) | incluye título, fecha, cine y funciones | Igual al esperado | ✅ Pasó |
| PT-TR-21 | Transversal | Unitaria (mocks) | pytest | run_initial_scrape | SetWithTTL('scraped_data', JSON serializado, CACHE_TTL) una vez, por el mock del cliente gRPC | Igual al esperado | ✅ Pasó |
| PT-TR-22 | Transversal | Unitaria (mocks) | pytest | SetWithTTL responde ok=false | informa el error y termina sin excepción | Igual al esperado | ✅ Pasó |
| PT-TR-23 | Transversal | Unitaria (mocks) | pytest | La estrategia lanza una excepción | no se escribe en caché y se cierran navegador y cliente | Igual al esperado | ✅ Pasó |
| PT-TR-24 | Transversal | Unitaria (mocks) | pytest | Chromium no arranca (start falla) | se informa el error, sin excepción secundaria, y se cierra el cliente gRPC | 1.ª corrida: falló (DEF-03). Tras la corrección: igual al esperado | ✅ Pasó (tras DEF-03) |
| PT-TR-25 | Transversal | Integración (gRPC aio simulado) | pytest | CacheClient.set_with_ttl | SetWithTTLRequest con clave, valor y TTL; devuelve ok | Igual al esperado | ✅ Pasó |
| PT-TR-26 | Transversal | Integración (gRPC aio simulado) | pytest | set_json + get | serializa sin escapar acentos y get devuelve el objeto decodificado | Igual al esperado | ✅ Pasó |
| PT-TR-27 | Transversal | Integración (gRPC aio simulado) | pytest | get de clave inexistente y health | None y redis_connected=True | Igual al esperado | ✅ Pasó |
| PT-TR-28 | Transversal | Integración (gRPC aio simulado) | pytest | CacheClient sin argumentos | host y puerto desde GRPC_HOST/GRPC_PORT | Igual al esperado | ✅ Pasó |
| PT-TR-30 | Transversal | Unitaria | go test + Testify + miniredis | Get de una clave inexistente | found=false sin error | Igual al esperado | ✅ Pasó |
| PT-TR-31 | Transversal | Unitaria | go test + Testify + miniredis | Set y luego Get | devuelve el mismo valor y la clave no vence | Igual al esperado | ✅ Pasó |
| PT-TR-32 | Transversal | Unitaria | go test + Testify + miniredis | Delete y Exists | reflejan la existencia de la clave | Igual al esperado | ✅ Pasó |
| PT-TR-33 | Transversal | Unitaria | go test + Testify + miniredis | SetWithTTL (cartelera del scrapper) | la clave vence al cumplirse el TTL | Igual al esperado | ✅ Pasó |
| PT-TR-34 | Transversal | Unitaria | go test + Testify + miniredis | SetTTL sobre una clave existente y GetTTL | devuelve los segundos restantes | Igual al esperado | ✅ Pasó |
| PT-TR-35 | Transversal | Unitaria | go test + Testify + miniredis | GetTTL de clave sin vencimiento y de clave inexistente | -1 y -2 respectivamente (semántica Redis) | 1.ª corrida: falló (DEF-02). Tras la corrección: igual al esperado | ✅ Pasó (tras DEF-02) |
| PT-TR-36 | Transversal | Unitaria | go test + Testify + miniredis | PushBatch (chat) | agrega en orden, devuelve la longitud y aplica el TTL | Igual al esperado | ✅ Pasó |
| PT-TR-37 | Transversal | Unitaria | go test + Testify + miniredis | PushBatch vacío | longitud 0 y no crea la clave | Igual al esperado | ✅ Pasó |
| PT-TR-38 | Transversal | Unitaria | go test + Testify + miniredis | PushBatch con TTL 0 | no fija vencimiento | Igual al esperado | ✅ Pasó |
| PT-TR-39 | Transversal | Unitaria | go test + Testify + miniredis | Range con índices negativos (-50, -1) | últimos N mensajes en orden cronológico | Igual al esperado | ✅ Pasó |
| PT-TR-40 | Transversal | Unitaria | go test + Testify + miniredis | Range de una sala sin historial | lista vacía sin error | Igual al esperado | ✅ Pasó |
| PT-TR-41 | Transversal | Unitaria | go test + Testify + miniredis | HSet/HGet/HGetAll/HDel | CRUD de campos de un hash | Igual al esperado | ✅ Pasó |
| PT-TR-42 | Transversal | Integración (gRPC bufconn) | go test + Testify + miniredis | Subscribe por gRPC (stream) + Publish | el suscriptor recibe el mensaje | Igual al esperado | ✅ Pasó |
| PT-TR-43 | Transversal | Integración (gRPC bufconn) | go test + Testify + miniredis | Cliente gRPC: SetWithTTL + Get + PushBatch + Range de punta a punta | — | Igual al esperado | ✅ Pasó |
| PT-TR-44 | Transversal | Unitaria | go test + Testify + miniredis | Health con Redis disponible | healthy, redis connected=true | Igual al esperado | ✅ Pasó |
| PT-TR-45 | Transversal | Unitaria | go test + Testify + miniredis | Redis caído | Health unhealthy y las operaciones devuelven codes.Internal | Igual al esperado | ✅ Pasó |
| PT-TR-46 | Transversal | Unitaria | go test + Testify + miniredis | getEnv | usa la variable si está definida y el valor por defecto si no | Igual al esperado | ✅ Pasó |
| PT-TR-50 | Transversal | E2E | Playwright (Chromium + WebKit mobile) | Flujo login (cookie JWT), cartelera, elegir función, crear sala y chatear | sala creada con el usuario como anfitrión y mensaje visible en el chat | Igual al esperado (mobile-chromium ✓, mobile-webkit ✓) | ✅ Pasó |
| PT-TR-51 | Transversal | E2E | Playwright (Chromium + WebKit mobile) | Dos usuarios en la misma sala | el segundo se une y ambos reciben los mensajes en tiempo real (y persisten al recargar) | Igual al esperado (mobile-chromium ✓, mobile-webkit ✓) | ✅ Pasó |
| PT-TR-52 | Transversal | E2E | Playwright (Chromium + WebKit mobile) | Ruta interna sin sesión y login con ?error=invalid_state | botón de Google visible y aviso 'La sesión de inicio expiró' | Igual al esperado (mobile-chromium ✓, mobile-webkit ✓) | ✅ Pasó |
| PT-TR-53 | Transversal | E2E | Playwright (Chromium + WebKit mobile) | Cartelera de hoy | la función ya iniciada (00:01) aparece deshabilitada y la de las 23:59 habilitada | Igual al esperado (mobile-chromium ✓, mobile-webkit ✓) | ✅ Pasó |
| PT-TR-54 | Transversal | E2E | Playwright (Chromium + WebKit mobile) | Viewport mobile | feed, salas y crear sala sin scroll horizontal | Igual al esperado (mobile-chromium ✓, mobile-webkit ✓) | ✅ Pasó |
| PT-TR-55 | Transversal | E2E | Playwright (Chromium + WebKit mobile) | Desde el feed, abrir el chat de una sala propia | a lo sumo 3 clics (RNF de usabilidad) | Igual al esperado (mobile-chromium ✓, mobile-webkit ✓) | ✅ Pasó |
| PT-TR-56 | Transversal | E2E | Playwright (Chromium + WebKit mobile) | El único miembro abandona la sala desde la UI | la sala desaparece y vuelve a 'Salas abiertas' | Igual al esperado (mobile-chromium ✓, mobile-webkit ✓) | ✅ Pasó |
| PT-TR-57 | Transversal | E2E | Playwright (Chromium + WebKit mobile) | Navegación completa con la CSP de nginx (feed, crear sala, sala con chat) | sin violaciones de CSP ni errores en consola | Sin violaciones de CSP ni errores en consola (regresión de DEF-04) | ✅ Pasó |
| PT-TR-60 | Transversal | Carga | k6 | GET /cartelera con rampa a 50 VUs durante 1 min 45 s | p95 < 200 ms y tasa de error < 1 % | p95 6.0 ms, p99 8.8 ms, error 0.00 % | ✅ Pasó |
| PT-TR-61 | Transversal | Carga | k6 | GET /salas (con sesión) con rampa a 50 VUs durante 1 min 45 s | p95 < 200 ms y tasa de error < 1 % | p95 10.0 ms, p99 13.5 ms, error 0.00 % | ✅ Pasó |
| PT-TR-62 | Transversal | Estrés | k6 | Estrés: GET /cartelera + GET /salas con 200 VUs | p95 < 200 ms y tasa de error < 1 % | 293 req/s; p95 107.4 ms / 111.1 ms, p99 151.2 ms / 156.0 ms, error 0 % | ✅ Pasó |
| PT-TR-63 | Transversal | Carga | k6 | Chat por WebSocket con 60 usuarios en 12 salas, 1 mensaje cada 2 s durante 45 s | entrega p95 < 200 ms, history al conectar y 0 errores | entrega p95 3.0 ms, p99 4.0 ms; 1320 enviados / 6600 recibidos (×5 miembros, sin pérdidas); history 100 %; errores WS 0 %. Ticket inicial en frío: p95 255.7 ms (OBS-01) | ✅ Pasó (con OBS-01) |
| PT-TR-64 | Transversal | Carga (ráfaga) | k6 | 5 ráfagas de 60 pedidos simultáneos de ticket de chat | p95 < 200 ms en cada ráfaga y 0 errores | p95 por ráfaga: 184 / 100 / 92 / 102 / 100 ms; error 0 % | ✅ Pasó |
| PT-TR-70 | Transversal | Seguridad | OWASP ZAP baseline | ZAP baseline (spider + AJAX spider, con cookie de sesión) contra https://localhost:8443 | 0 alertas de riesgo High | 0 High antes y después; WARN 14 → 7 reglas | ✅ Pasó |
| PT-TR-71 | Transversal | Seguridad | OWASP ZAP baseline | Respuestas del frontend | CSP, X-Frame-Options, X-Content-Type-Options, HSTS y Permissions-Policy presentes (sin alertas 10038/10020/10021/10035/10063) | 1.ª corrida: falló (DEF-04, alertas 10038, 10020, 10063, 10035, 10021). Tras la corrección: sin alertas | ✅ Pasó (tras DEF-04) |
| PT-TR-72 | Transversal | Seguridad | OWASP ZAP baseline | Cabeceras de respuesta | no revelan versión de nginx ni X-Powered-By de Express (sin alertas 10036/10037) | 1.ª corrida: falló (DEF-04, alertas 10037, 10036). Tras la corrección: sin alertas | ✅ Pasó (tras DEF-04) |
