# Integración del chat-controller con el cache-controller vía gRPC

| Campo | Detalle |
| :--- | :--- |
| **Fecha** | 16 de septiembre de 2026 |
| **Módulo** | `src/chat-controller/`, `src/cache-controller/` |
| **Tema** | Integración del chat grupal (WebSockets) con la caché Redis vía cliente gRPC; persistencia por batches con TTL de ~3 días |
| **Rama de trabajo** | `cache-chat` |
| **Stack involucrado** | Node.js 22 (Express 4, ws), Go (go.mod `go 1.25`), gRPC, go-redis v9.22.0, @grpc/grpc-js, @grpc/proto-loader |

---

## Objetivos de la sesión

1. Analizar y documentar cómo funcionan hoy `chat-controller` y `cache-controller`.
2. Definir el plan de integración para que `chat-controller` deje de tocar Redis directamente y envíe los mensajes del chat al `cache-controller` vía un cliente gRPC.
3. Cachear la información del chat en **batches** (lotes) por evento con una duración de **aproximadamente 3 días** en Redis.
4. Implementar el lado Go (nuevo RPC `PushBatch`) y el lado Node (cliente gRPC con buffer de batches).
5. Eliminar la dependencia directa a Redis (`ioredis`) del `chat-controller`.

---

## Estado inicial

### `src/chat-controller/` (Node.js + Express + ws + ioredis)

- Chat grupal en tiempo real por evento (`event_id`) usando WebSockets.
- **Acceso directo a Redis** hoy:
  - `sendHistory` → `redis.lrange("chat:{eventId}", -50, -1)` (`src/server.js:63-71`)
  - `saveAndBroadcast` → `redis.rpush("chat:{eventId}", JSON.stringify(message))` (`src/server.js:73-89`)
- Cliente ioredis en `src/database.js`; health check por ping directo en `src/routes/health.routes.js`.

### `src/cache-controller/` (Go + gRPC + Redis)

- Servidor gRPC en `:50051` que envuelve operaciones Redis (`Get`, `Set`, `Delete`, `Exists`, `SetTTL`, `GetTTL`, `SetWithTTL`, `Push`, `Range`, `HSet`, `HGet`, `HGetAll`, `HDel`, `Publish`, `Subscribe`, `Health`).
- **Limitación:** `Push` (RPUSH) no acepta múltiples valores ni TTL, por lo que el contrato actual no soporta batching por lote ni expiración automática.

---

## Trabajo realizado

### 1. cache-controller (Go) — batching del lado del servidor

#### `proto/cache.proto`
- Agregado el RPC unario `PushBatch`:
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

#### `server.go`
- Implementado handler `PushBatch`:
  - Usa pipeline Redis: `RPush` con todos los valores + `Expire(key, ttl_seconds)`
  - Retorna la longitud de la lista tras el push
  - Manejo de errores con `status.Errorf(codes.Internal, ...)`

#### Regeneración de stubs
- Ejecutado `protoc` con plugins `protoc-gen-go` y `protoc-gen-go-grpc`:
```bash
protoc --go_out=pb --go-grpc_out=pb proto/cache.proto
```
- Archivos regenerados: `pb/cache.pb.go` y `pb/cache_grpc.pb.go` (incluyen `PushBatchRequest`, `PushBatchResponse`, cliente y servidor)

#### `cmd/testclient/main.go`
- Agregado test de `PushBatch`:
  - Envía 3 valores con TTL 259200s (3 días)
  - Verifica con `Range` que los valores se persistieron

#### `tui/operations.go`
- Agregada operación `PushBatch` en categoría "Lists":
  - Campos: Key, Values (comma-separated), TTL (seconds)

### 2. chat-controller (Node) — cliente gRPC y batching

#### `package.json`
- Agregadas dependencias:
  - `@grpc/grpc-js` ^1.10.0
  - `@grpc/proto-loader` ^0.7.13
- Eliminada dependencia `ioredis` ^5.4.1

#### Nuevo `src/cache-client.js`
Cliente gRPC completo con:
- **Conexión lazy** a `CACHE_GRPC_ADDR` (default `localhost:50051`)
- **Carga dinámica del .proto** via `@grpc/proto-loader` (el `.proto` de cache-controller es la fuente de verdad, sin generar stubs JS)
- **Wrappers**:
  - `range(key, start, stop)` → llama RPC `Range`
  - `pushBatch(key, values, ttl)` → llama RPC `PushBatch`
  - `health()` → llama RPC `Health`
- **Buffer por evento** (batching del lado cliente):
  - Acumula mensajes en memoria por `eventId`
  - Flushea en batch cuando llega a **~10 mensajes** o **~3 segundos**, lo que ocurra primero
  - TTL deslizante: **259200 segundos (3 días)** aplicado en cada flush
  - Método `flushAll()` para vaciar buffers al apagado (SIGINT/SIGTERM)

#### `src/server.js`
- `sendHistory` → `cacheClient.range("chat:"+eventId, -50, -1)` (reemplaza `redis.lrange`)
- `saveAndBroadcast` → `cacheClient.enqueue(eventId, msgJSON)` (reemplaza `redis.rpush`, encola para batch)
- Health check inicial vía `cacheClient.health()`
- Shutdown con `cacheClient.flushAll()` antes de cerrar

#### `src/routes/health.routes.js`
- Health check ahora usa RPC `Health` del cache-controller
- Respuesta incluye `status` y `cache` (ok/error), con `status: degraded` si Redis no conecta

#### Eliminado `src/database.js`
- Retirado cliente ioredis completamente

### 3. Política de TTL (3 días)

- `ttl_seconds = 259200` (3 días) aplicado en cada flush
- **TTL deslizante**: cada batch reinicia la expiración; los chats activos se mantienen y los inactivos por 3 días expiran automáticamente

### 4. Corrección de bug en serialización WebSocket
- `socket.send()` esperaba string, se pasaba objeto → error `The first argument must be of type string...`
- Corregido: `socket.send(JSON.stringify(WsMessage.history(messages).toJSON()))`

---

## Verificación

### Pruebas realizadas
1. **cache-controller**: `go build ./...` → compila sin errores
2. **cache-controller**: `go run .` → servidor inicia en `:50051`, health check OK
3. **chat-controller**: `npm install` → dependencias instaladas
4. **chat-controller**: `node --check src/server.js && node --check src/cache-client.js` → sin errores de sintaxis
5. **Integración end-to-end**:
   - Levantar Redis + cache-controller + chat-controller
   - Abrir `test-chat.html` servido via HTTP (puerto 8080)
   - Múltiples usuarios se unen al mismo `event_id`
   - Historial carga correctamente (4, 6, 10 items verificados en logs)
   - Mensajes nuevos se encolan y flushean por batches (logs muestran `PushBatch success length=N`)
   - TTL verificado en Redis: `TTL chat:{eventId}` ≈ 259200s

### Logs de verificación exitosos
```
[cache-client] Range success for chat:1235: 4 items
[server] sendHistory parsed messages: [ChatMessage, ChatMessage, ...]
[cache-client] enqueued for chat:1235, buffer size: 1
[cache-client] Flushing 1 messages for chat:1235
[cache-client] PushBatch success for chat:1235: length=5
```

---

## Decisiones técnicas

1. **Batching en el cliente:** el chat-controller acumula y envía un `PushBatch` unario (lote multi-valor). Más simple y robusto ante reconexiones que un streaming persistente por evento.
2. **Solo vía gRPC:** se elimina ioredis; `chat-controller` se comunica exclusivamente con el cache-controller, que centraliza el acceso a Redis.
3. **TTL deslizante:** se renueva en cada flush para que chats con actividad sobrevivan y los inactivos expiren al cabo de 3 días.
4. **`proto-loader` dinámico:** evita generar stubs JS y mantiene el `.proto` como contrato único.
5. **`PushBatch` atomiza RPUSH + EXPIRE:** el TTL se aplica en la misma operación de lote para no dejar listas sin expiración.
6. **Buffer por evento en memoria:** cada `eventId` tiene su buffer independiente; flush por tamaño (10) o tiempo (3s).

---

## Archivos creados / modificados

| Archivo | Acción | Descripción |
| :--- | :--- | :--- |
| `src/cache-controller/proto/cache.proto` | Modificado | RPC `PushBatch` + mensajes `PushBatchRequest`/`PushBatchResponse` |
| `src/cache-controller/pb/cache.pb.go` | Generado | Mensajes protobuf regenerados |
| `src/cache-controller/pb/cache_grpc.pb.go` | Generado | Stubs gRPC regenerados |
| `src/cache-controller/server.go` | Modificado | Handler `PushBatch` (RPUSH multi + EXPIRE) |
| `src/cache-controller/cmd/testclient/main.go` | Modificado | Test de `PushBatch` |
| `src/cache-controller/tui/operations.go` | Modificado | Operación `PushBatch` en el TUI |
| `src/chat-controller/package.json` | Modificado | Dependencias `@grpc/grpc-js`, `@grpc/proto-loader`; quitado `ioredis` |
| `src/chat-controller/src/cache-client.js` | **Nuevo** | Cliente gRPC + buffer de batches por evento |
| `src/chat-controller/src/server.js` | Modificado | Historial por `Range` y guardado por `PushBatch` |
| `src/chat-controller/src/routes/health.routes.js` | Modificado | Health vía RPC `Health` |
| `src/chat-controller/src/database.js` | Eliminado | Se retira ioredis |
| `src/chat-controller/test-chat.html` | Modificado | Fallback `localhost` para `location.hostname` vacío |

---

## Próximos pasos

1. **Autenticación gRPC:** Agregar API keys o JWT al cache-controller para que solo módulos autorizados accedan.
2. **Monitoreo:** Integrar métricas (latencia, throughput, errores) en cache-controller para Grafana/Prometheus.
3. **Despliegue:** Docker Compose con los tres servicios (Redis, cache-controller, chat-controller).
4. **Conectar scrapper:** Modificar el FastAPI server para que almacene datos scrapeados vía gRPC (usando el mismo contrato).
5. **Rate limiting:** Implementar en cache-controller para proteger Redis de abusos.
6. **Tests automatizados:** Suite de tests end-to-end para la integración chat ↔ cache.

---

## Session

```bash
opencode -s ses_f7cf70020ffevnVV4t5FlqmO0i
```