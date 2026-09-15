# Integración del chat-controller con el cache-controller vía gRPC

| Campo | Detalle |
| :--- | :--- |
| **Fecha** | 08 de septiembre de 2026 |
| **Módulo** | `src/chat-controller/`, `src/cache-controller/` |
| **Tema** | Integración del chat grupal (WebSockets) con la caché Redis vía cliente gRPC; persistencia por batches con TTL de ~3 días |
| **Rama de trabajo** | `cache-chat` |
| **Stack involucrado** | Node.js 22 (Express 4, ws), Go (go.mod `go 1.25`), gRPC, go-redis v9.22.0, @grpc/grpc-js, @grpc/proto-loader |

---

## Objetivos de la sesión

1. Analizar y documentar cómo funcionan hoy `chat-controller` y `cache-controller`.
2. Definir el plan de integración para que `chat-controller` deje de tocar Redis directamente y envíe los mensajes del chat al `cache-controller` vía un cliente gRPC.
3. Cachear la información del chat en **batches** (lotes) por evento con una duración de **aproximadamente 3 días** en Redis.

---

## Estado actual

### `src/chat-controller/` (Node.js + Express + ws + ioredis)

- Chat grupal en tiempo real por evento (`event_id`) usando WebSockets.
- **Acceso directo a Redis** hoy:
  - `sendHistory` → `redis.lrange("chat:{eventId}", -50, -1)` (`src/server.js:63-71`)
  - `saveAndBroadcast` → `redis.rpush("chat:{eventId}", JSON.stringify(message))` (`src/server.js:73-89`)
- Cliente ioredis en `src/database.js`; health check por ping directo en `src/routes/health.routes.js`.

### `src/cache-controller/` (Go + gRPC + Redis)

- Servidor gRPC en `:50051` que envuelve operaciones Redis (`Get`, `Set`, `Delete`, `Exists`, `SetTTL`, `GetTTL`, `Push`, `Range`, `HSet`, `HGet`, `HGetAll`, `HDel`, `Publish`, `Subscribe`, `Health`).
- **Limitación:** `Push` (RPUSH) no acepta múltiples valores ni TTL, por lo que el contrato actual no soporta batching por lote ni expiración automática.

---

## Plan de implementación

### 1. cache-controller (Go) — batching del lado del servidor

- **`proto/cache.proto`**: agregar el RPC unario

  ```proto
  rpc PushBatch(PushBatchRequest) returns (PushBatchResponse);

  message PushBatchRequest {
    string key = 1;
    repeated string values = 2;
    int64 ttl_seconds = 3;
  }

  message PushBatchResponse {
    int64 length = 1;
  }
  ```

- **`server.go`**: implementar `PushBatch` → `RPush` con todos los valores + `Expire(key, ttl_seconds)` (pipeline), devolviendo el largo de la lista.
- **Regenerar** `pb/cache.pb.go` y `pb/cache_grpc.pb.go` con `protoc`.
- **`cmd/testclient/main.go`** y **`tui/operations.go`**: agregar `PushBatch` para verificar el lote y su TTL.

### 2. chat-controller (Node) — cliente gRPC y batching

- **`package.json`**: agregar `@grpc/grpc-js` y `@grpc/proto-loader` (carga dinámica del `.proto`, sin generar stubs JS; el `.proto` de cache-controller es la fuente de verdad).
- **Nuevo `src/cache-client.js`**:
  - Conexión lazy a `CACHE_GRPC_ADDR` (default `localhost:50051`).
  - Wrappers `range(key, start, stop)`, `pushBatch(key, values, ttl)`, `health()`.
  - Buffer por evento: acumula mensajes y flushea en batch cuando llega a **~10 mensajes** o **~3 s**, lo que ocurra primero.
- **`src/server.js`**:
  - `sendHistory` → `cacheClient.range("chat:"+eventId, -50, -1)` (reemplaza `redis.lrange`).
  - `saveAndBroadcast` → `cacheClient.enqueue(eventId, msgJSON)` (reemplaza `redis.rpush`).
- **Eliminar ioredis**: borrar `src/database.js`; `health.routes.js` y el arranque del servidor pasan a usar el RPC `Health`.

### 3. Política de TTL (3 días)

- `ttl_seconds = 259200` (3 días) aplicado en cada flush.
- **TTL deslizante**: cada batch reinicia la expiración; los chats activos se mantienen y los inactivos por 3 días expiran automáticamente.

### 4. Verificación

- Levantar Redis + cache-controller + chat-controller y probar con `test-chat.html` (`sendHistory` + envío).
- Confirmar en Redis que la lista `chat:{eventId}` se llena por batches y que `TTL` ≈ 259200 s.

---

## Decisiones técnicas

1. **Batching en el cliente:** el chat-controller acumula y envía un `PushBatch` unario (lote multi-valor). Más simple y robusto ante reconexiones que un streaming persistente por evento.
2. **Solo vía gRPC:** se elimina ioredis; `chat-controller` se comunica exclusivamente con el cache-controller, que centraliza el acceso a Redis.
3. **TTL deslizante:** se renueva en cada flush para que chats con actividad sobrevivan y los inactivos expiren al cabo de 3 días.
4. **`proto-loader` dinámico:** evita generar stubs JS y mantiene el `.proto` como contrato único.
5. **`PushBatch` atomiza RPUSH + EXPIRE:** el TTL se aplica en la misma operación de lote para no dejar listas sin expiración.

---

## Pendientes y riesgos

- **Merge de rama pendiente:** el usuario traerá primero cambios de otra rama antes de regenerar los protos.
- **Toolchain:** `protoc` no está instalado y el Go local es `1.19.8`, mientras `go.mod` exige `go 1.25` (las dependencias como go-redis v9.22.0 la inducen). Regenerar `pb/*.go` y compilar requiere resolver esa brecha (instalar `protoc` + toolchain, o regenerar en el entorno del usuario).

---

## Archivos a crear / modificar

| Archivo | Acción | Descripción |
| :--- | :--- | :--- |
| `src/cache-controller/proto/cache.proto` | Modificado | RPC `PushBatch` + mensajes `PushBatchRequest`/`PushBatchResponse` |
| `src/cache-controller/pb/cache.pb.go` | Generado | Mensajes protobuf regenerados |
| `src/cache-controller/pb/cache_grpc.pb.go` | Generado | Stubs gRPC regenerados |
| `src/cache-controller/server.go` | Modificado | Handler `PushBatch` (RPUSH multi + EXPIRE) |
| `src/cache-controller/cmd/testclient/main.go` | Modificado | Test de `PushBatch` |
| `src/cache-controller/tui/operations.go` | Modificado | Operación `PushBatch` en el TUI |
| `src/chat-controller/package.json` | Modificado | Dependencias `@grpc/grpc-js`, `@grpc/proto-loader` |
| `src/chat-controller/src/cache-client.js` | **Nuevo** | Cliente gRPC + buffer de batches por evento |
| `src/chat-controller/src/server.js` | Modificado | Historial por `Range` y guardado por `PushBatch` |
| `src/chat-controller/src/routes/health.routes.js` | Modificado | Health vía RPC `Health` |
| `src/chat-controller/src/database.js` | Eliminado | Se retira ioredis |

---

## Próximos pasos

1. Traer los cambios de la rama pendiente y resolver el toolchain de Go/`protoc`.
2. Implementar el lado Go (`proto`, `server.go`, TBU) y regenerar los stubs.
3. Implementar el lado Node (`cache-client.js`, `server.js`, health) y quitar ioredis.
4. Probar extremo a extremo y validar batches + TTL en Redis.

# Session

```bash
opencode -s ses_f7cf70020ffevnVV4t5FlqmO0i
```

