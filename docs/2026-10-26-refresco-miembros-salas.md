# Refresco de miembros de salas entre usuarios

| Campo | Detalle |
| :--- | :--- |
| **Fecha** | 26 de octubre de 2026 |
| **Módulos** | `src/frontend/` |
| **Tema** | Diagnóstico y corrección de la desincronización del número de integrantes de una sala entre navegadores |
| **Stack involucrado** | React 19, React Router 7, Vite 8, oxlint |
| **Alcance** | Solo frontend: no se modificó ningún backend ni el protocolo WebSocket |

---

## Estado inicial

- El contador de miembros solo se actualizaba para el usuario que ejecutaba la acción (`joinRoom`/`leaveRoom`) o cuando navegaba/recargaba.
- `src/frontend/src/pages/RoomDetail.jsx` pedía la sala una sola vez al montar el componente o al cambiar el `id`.
- `src/frontend/src/pages/Feed.jsx` ejecutaba `loadRooms()` únicamente al montar el feed.
- `src/frontend/src/contexts/AppContext.jsx` mantenía las salas en memoria del navegador. Las respuestas de alta/baja actualizaban solo el contexto local del usuario que las ejecutaba.
- `src/frontend/src/hooks/useSalaChat.js` solo procesaba eventos WebSocket de tipo `history` y `message`; no existía ningún evento de altas/bajas de miembros.
- No había polling, ni listeners de `focus`/`visibilitychange`, ni otro mecanismo que refrescara las salas de los demás usuarios.

**Consecuencia:** cada navegador conservaba una copia propia y obsoleta de `rooms`; los cambios de membresía de otros usuarios no se propagaban hasta que una interacción local disparaba un nuevo fetch.

---

## Trabajo realizado

### 1. Hook de polling (`src/frontend/src/hooks/usePolling.js`, nuevo)

Se agregó un hook reutilizable que:

- Ejecuta el callback cada `intervalMs`.
- Evita solicitudes superpuestas mediante un flag `inFlight`.
- Pausa el intervalo cuando `document.visibilityState === "hidden"`.
- Refresca al volver a la pestaña (`visibilitychange`) y al recuperar el foco (`focus`).
- Ignora errores transitorios para no cortar la secuencia de polling.
- Limpia el intervalo y los listeners al desmontar.
- Permite un primer refresco inmediato mediante la opción `immediate`.

### 2. Refresco silencioso de salas (`src/frontend/src/contexts/AppContext.jsx`)

`loadRooms` ahora acepta `{ silent = false }`:

- En modo normal mantiene el comportamiento previo: `roomsStatus = "loading"`, limpieza de errores y actualización de `roomsError`/`roomsStatus` ante fallos.
- En modo silencioso refresca `rooms` y deja `roomsStatus` en `"ready"` sin mostrar el estado de carga.
- Si falla un refresco silencioso, conserva los últimos datos válidos en lugar de mostrar un error de pantalla completa.

### 3. Detalle de sala (`src/frontend/src/pages/RoomDetail.jsx`)

- Se agregó polling de `loadRoom(id)` cada **5 segundos** mientras la sala esté disponible.
- El refresco actualiza miembros, cupos y el estado del botón de unirse/salir sin recargar la página.
- Se mantiene la carga inicial existente y el refresco inmediato al recuperar visibilidad/foco.

### 4. Feed de salas (`src/frontend/src/pages/Feed.jsx`)

- Se agregó polling silencioso de `loadRooms({ silent: true })` cada **10 segundos**.
- El polling solo está activo cuando la vista actual es `vista=salas`; no consume recursos en la cartelera.
- Al entrar a la vista de salas se dispara un refresco inmediato.
- Los contadores de `RoomCard` y el badge de cantidad de salas se actualizan con el nuevo estado del contexto.

---

## Verificación realizada

- `npm run build` en `src/frontend/`: compilación exitosa con Vite 8.
- `npm run lint` en `src/frontend/`: sin errores nuevos. Se mantiene el warning preexistente de Fast Refresh en `AppContext.jsx` (`only-export-components`), porque el archivo exporta el componente y el hook `useAppContext`.
- Revisión de hooks: `usePolling` se invoca antes de cualquier retorno temprano de `RoomDetail`, por lo que el orden de hooks se mantiene estable.
- No se modificaron archivos del backend ni el contrato del WebSocket.

**Pendiente de prueba manual:** validar con dos navegadores/usuarios que las altas y bajas se reflejen dentro de los intervalos definidos. La verificación automatizada disponible en el proyecto se limita a lint y build.

---

## Decisiones técnicas

1. **Polling como solución frontend-only:** el chat WebSocket no emite eventos de membresía y no se podía modificar el backend, por lo que el polling es el único mecanismo viable para propagar cambios entre navegadores.
2. **Intervalos diferenciados:** 5 segundos en el detalle de sala (interacción activa) y 10 segundos en el feed (listado general), para equilibrar frescura y carga.
3. **Refresco silencioso:** evita el parpadeo del estado de carga y protege los datos visibles ante errores transitorios de red.
4. **Polling solo con pestaña visible:** reduce solicitudes innecesarias y refresca de inmediato cuando el usuario vuelve a la aplicación.
5. **Sin cambios en `AppContext` para el detalle:** `loadRoom` ya era silencioso respecto de los estados globales; solo se reutilizó desde el hook.
6. **Límite de latencia:** el contador de otros usuarios puede tardar hasta el intervalo configurado en actualizarse; no es tiempo real estricto.

---

## Archivos creados / modificados

| Archivo | Acción | Descripción |
| :--- | :--- | :--- |
| `src/frontend/src/hooks/usePolling.js` | **Nuevo** | Polling visible, sin solapamientos, con refresco al recuperar foco/visibilidad |
| `src/frontend/src/contexts/AppContext.jsx` | Modificado | `loadRooms({ silent })` para refrescos sin estado de carga ni pérdida de datos |
| `src/frontend/src/pages/RoomDetail.jsx` | Modificado | Polling de la sala cada 5 s |
| `src/frontend/src/pages/Feed.jsx` | Modificado | Polling silencioso de salas cada 10 s en la vista de salas |

---

## Próximos pasos

1. **Tiempo real real:** emitir un evento de membresía desde `reunion-controller` por WebSocket/SSE/Pub/Sub y consumirlo en el frontend para eliminar la dependencia del polling.
2. **Evitar fetch inicial duplicado:** al montar el Feed directamente en la vista de salas se hace la carga normal y además el tick inmediato del polling. Es inocuo, pero puede optimizarse con un ref que distinga el primer montaje del cambio de vista.
3. **Prueba end-to-end con dos usuarios:** cubrir alta, salida, sala completa, traspaso de anfitrión y eliminación de sala vacía mientras otro usuario observa el detalle y el feed.
4. **Intervalos configurables:** mover `ROOM_POLL_MS` y `ROOMS_POLL_MS` a constantes compartidas o variables de entorno si se necesita ajustar la carga en producción.
