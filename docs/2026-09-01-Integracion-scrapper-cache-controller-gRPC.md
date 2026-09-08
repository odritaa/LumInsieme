# Integración del scrapper con el cache-controller vía gRPC

| Campo | Detalle |
| :--- | :--- |
| **Fecha** | 1 de septiembre de 2026 |
| **Módulo** | `src/scrapper/` y `src/cache-controller/` |
| **Tema** | Integración del scrapper (Playwright) con el cache-controller (gRPC) para almacenar datos JSON en Redis |
| **Rama de trabajo** | `cache-scrapper` |
| **Stack involucrado** | Python 3.11, Playwright, gRPC (grpcio/grpcio-tools), Go 1.25, go-redis v9, Redis 7 |

---

## Objetivos de la sesión

1. Integrar ambos servicios para guardar el resultado del scrapper en formato JSON dentro de Redis, consultable por otros servicios.
2. Modificar `src/scrapper/main.py` para que sea un **cliente de gRPC** que envíe el resultado JSON al cache-controller, en lugar de escribir directamente en Redis ni guardarlo localmente.
3. Dejar de tocar Redis directamente desde el scrapper; todo el acceso a la caché pasa por el servidor gRPC.
4. Trabajar **únicamente** dentro de los directorios autorizados: `src/scrapper/` y `src/cache-controller/`.

---

## Trabajo realizado

### Fase 0 — Exploración de ambos servicios

Se relevó la estructura de `src/scrapper/` (FastAPI + Playwright, con el `main.py` con conflictos de merge sin resolver) y de `src/cache-controller/` (servidor gRPC en Go que envuelve Redis, puerto `:50051`, con 15 RPCs).

Hallazgos relevantes:

- El `main.py` del scrapper tenía marcadores de conflicto de merge sin resolver (`<<<<<<< HEAD`, `=======`, `>>>>>>> 1d517e3f`), por lo que no era un archivo Python ejecutable.
- El scrapper devolvía datos estructurados como lista de dicts keyed por fecha (`YYYY-MM-DD`) con listas de objetos `MovieData`.
- El cache-controller ya exponía RPCs `Get`, `Set`, `SetTTL`, `Health`, etc., pero ningún método que combinara "guardar con TTL" en una sola llamada.

### Fase 1 — Decisiones previas (consultadas al usuario)

Se consultaron 3 decisiones con el usuario antes de implementar:

| Pregunta | Decisión tomada |
| :--- | :--- |
| ¿Qué versión base usar para resolver los conflictos de merge de `main.py`? | **One-shot** con `asyncio.run()` (scrapea una vez y cierra) |
| ¿La lectura de datos también debe pasar por gRPC? | **Sí, todo vía gRPC** (escritura y lectura) |
| ¿Cómo manejar el TTL desde el scrapper? | **Agregar `SetWithTTL` al proto** (SET + EXPIRE en una sola llamada) |

### Fase 2 — Modificaciones en `src/cache-controller/` (con aviso previo aceptado)

#### 2.1. `proto/cache.proto`

Se agregó el RPC `SetWithTTL` al servicio `CacheService` dentro de la categoría TTL:

```protobuf
rpc SetWithTTL(SetWithTTLRequest) returns (SetWithTTLResponse);

message SetWithTTLRequest {
  string key = 1;
  string value = 2;
  int64 ttl_seconds = 3;
}

message SetWithTTLResponse {
  bool ok = 1;
}
```

#### 2.2. Regeneración del código Go

Se regeneraron `pb/cache.pb.go` y `pb/cache_grpc.pb.go` con las mismas versiones de las herramientas originales (`protoc-gen-go v1.36.12`, `protoc-gen-go-grpc v1.6.2`, `protoc v28.3`), de modo que coincidieran con las versiones ya presentes en el repo.

#### 2.3. `server.go`

Se implementó el handler `SetWithTTL`, que ejecuta un único `SET` de Redis con TTL:

```go
func (s *cacheServer) SetWithTTL(ctx context.Context, req *pb.SetWithTTLRequest) (*pb.SetWithTTLResponse, error) {
 ttl := time.Duration(req.TtlSeconds) * time.Second
 err := s.rdb.Set(ctx, req.Key, req.Value, ttl).Err()
 if err != nil {
  return nil, status.Errorf(codes.Internal, "redis SET with TTL failed: %v", err)
 }
 return &pb.SetWithTTLResponse{Ok: true}, nil
}
```

### Fase 3 — Modificaciones en `src/scrapper/`

#### 3.1. `pb/` (nuevo)

Se generaron los stubs Python del proto:

- `pb/cache_pb2.py` (mensajes)
- `pb/cache_pb2_grpc.py` (servicio/cliente)
- `pb/__init__.py` (para que sea paquete importable)

Se corrigió el import del `cache_pb2_grpc.py` generado de `import cache_pb2 as cache__pb2` a `from . import cache_pb2 as cache__pb2` para que funcione dentro del paquete `pb`.

#### 3.2. `grpc_client.py` (nuevo)

Cliente gRPC asíncrono que conecta al cache-controller:

- `connect()` — abre canal `aio.insecure_channel` en `GRPC_CONFIG`
- `set_with_ttl(key, value, ttl_seconds)` — invoca el RPC `SetWithTTL`
- `set_json(key, data, ttl_seconds)` — serializa a JSON y llama `set_with_ttl`
- `get(key)` — invoca el RPC `Get` y deserializa
- `health()` — invoca el RPC `Health`
- `close()` — cierra el canal

#### 3.3. `main.py` (reescrito)

Se resolvieron los conflictos de merge y se adoptó el enfoque **one-shot**:

- Se eliminaron `fastapi`, `uvicorn` y el cliente Redis directo.
- Se eliminaron los endpoints REST (`/health`, `/scrape/get_data`) — el cache-controller ya sirve vía gRPC.
- `run_initial_scrape()`:
  1. Conecta el cliente gRPC e inicia el controller de Playwright.
  2. Ejecuta las estrategias de scraping (`MultiplexStrategy`).
  3. Serializa los resultados con `PlaywrightBrowserController._serialize`.
  4. Envía el JSON al cache-controller con `SetWithTTL("scraped_data", payload, CACHE_TTL)`.
- Se cierran el browser y el canal gRPC al final.

#### 3.4. `utils/config.py`

Se reemplazaron `REDIS_CONFIG` y `SERVER_CONFIG` por `GRPC_CONFIG`:

```python
GRPC_CONFIG = {
    "host": os.getenv("GRPC_HOST"),
    "port": int(os.getenv("GRPC_PORT")),
}
```

#### 3.5. `.env`

Se eliminaron las variables de Redis/HOST/PORT y se agregaron:

```
GRPC_HOST="localhost"
GRPC_PORT=50051
CACHE_TTL=3600
SCRAPPING_DAYS=5
```

#### 3.6. `requirements.txt`

- Agregados: `grpcio==1.83.1`, `grpcio-tools==1.83.1`
- Removidos: `redis`, `fastapi`, `uvicorn`

#### 3.7. `.gitignore`

Se simplificaron las reglas de `__pycache__`: de reglas por directorio a un patrón global `**/__pycache__/`.

---

## Errores encontrados y soluciones

| Error | Solución |
| :--- | :--- |
| `protoc` no instalado y no se podía usar `sudo` | Se descargó Go 1.25 y `protoc` localmente en `/tmp/opencode`, sin permisos de superusuario |
| Go del sistema era 1.19 y el módulo exige `go 1.25.0` | Se usó Go 1.25 descargado en `/tmp/opencode/goroot` para compilar |
| `protoc --go_opt=paths=source_relative` generaba los archivos en `proto/` en vez de `pb/` | Se usó `paths=import` (default), que genera en `pb/` gracias al `go_package` declarado |
| El `cache_pb2_grpc.py` Python generado importaba `cache_pb2` como módulo top-level | Se corrigió a import relativo `from . import cache_pb2 as cache__pb2` |
| `ModuleNotFoundError: No module named 'grpc'` en el venv | Se instalaron `grpcio` y `grpcio-tools` en el venv de `src/scrapper/env` |
| `pkill` colgaba la terminal | Se identificó y terminó el proceso del servidor de prueba por su PID |

---

## Verificación de extremo a extremo

Se compiló y levantó el servidor gRPC del cache-controller (`go build` + ejecución), con Redis activo en `:6379`, y se validó:

1. **Cliente gRPC directo:** `health` → `redis_connected: True`; `set_with_ttl` → `ok: True`; `get` → devolvió el JSON guardado.
2. **Flujo completo del scrapper:** ejecutar `main.py` realizó el scraping real de `multiplex.com.ar` (5 días, 18 películas el primer día, ej. "Coyote Vs Acme") y guardó ~41 KB en la clave `scraped_data` con TTL de 3600 s en Redis.
3. **Lectura vía gRPC:** la clave se recuperó con `Get`, confirmando que otros servicios pueden consultarla sin tocar Redis directamente.

El proceso de prueba (servidor gRPC temporal) se detuvo y la clave de prueba `test:key` fue limpiada al finalizar.

---

## Flujo resultante

```
Scrapper (Python)                     Cache-Controller (Go)              Otros servicios
       │                                      │                              │
  scrape web ──→ JSON ──→ SetWithTTL ──→ Redis SET+EXPIRE ──→ Get ──→ Redis GET
       │                                      │                              │
    cierra()                              sirve en :50051                  consultan
```

---

## Decisiones técnicas

1. **Todo el acceso a caché vía gRPC:** El scrapper ya no toca Redis directamente ni expone endpoints REST; toda escritura y lectura pasa por el cache-controller.
2. **Enfoque one-shot:** Se eligió el modelo de ejecución one-shot (`asyncio.run`) sobre el servidor FastAPI para el `main.py`, alineándolo con la versión entrante del merge.
3. **Nuevo RPC `SetWithTTL`:** En lugar de usar `Set` + `SetTTL` en dos llamadas (lo que no es atómico), se agregó un RPC que combina SET + EXPIRE en una sola operación.
4. **Generación de stubs por lenguaje:** El mismo `cache.proto` se compila a Go (para el cache-controller) y a Python (para el scrapper), garantizando contrato único y sincronizado.
5. **TTL configurable:** Se mantuvo `CACHE_TTL` (3600 s) como configuración del scrapper, ahora usado en la llamada `SetWithTTL`.

---

## Archivos creados / modificados

### `src/cache-controller/`

| Archivo | Estado | Descripción |
| :--- | :--- | :--- |
| `proto/cache.proto` | Modificado | Agregado RPC y mensajes `SetWithTTL` |
| `pb/cache.pb.go` | Regenerado | Mensajes protobuf actualizados |
| `pb/cache_grpc.pb.go` | Regenerado | Stubs gRPC actualizados |
| `server.go` | Modificado | Implementación del handler `SetWithTTL` |

### `src/scrapper/`

| Archivo | Estado | Descripción |
| :--- | :--- | :--- |
| `pb/cache_pb2.py` | **Nuevo** | Mensajes protobuf Python generados |
| `pb/cache_pb2_grpc.py` | **Nuevo** | Stubs gRPC Python generados |
| `pb/__init__.py` | **Nuevo** | Paquete `pb` |
| `grpc_client.py` | **Nuevo** | Cliente gRPC asíncrono |
| `main.py` | Modificado | Reescrito como cliente gRPC one-shot (resuelve conflictos de merge) |
| `utils/config.py` | Modificado | `REDIS_CONFIG`/`SERVER_CONFIG` → `GRPC_CONFIG` |
| `.env` | Modificado | Variables de gRPC en lugar de Redis/HOST/PORT |
| `requirements.txt` | Modificado | `grpcio`/`grpcio-tools` en; `redis`/`fastapi`/`uvicorn` fuera |
| `.gitignore` | Modificado | Regla global `**/__pycache__/` |

---

## Próximos pasos

1. **Actualizar `Dockerfile` / `entrypoint.sh` del scrapper:** El `main.py` ahora es one-shot y no sirve como servidor HTTP. Habría que ajustar el contenedor y el entrypoint en consecuencia. *(Quedó fuera de los directorios autorizados en esta sesión.)*
2. **Despliegue coordinado:** Levantar cache-controller + Redis antes que el scrapper para garantizar la conexión gRPC.
3. **Autenticación:** Agregar mecanismo de autenticación al servidor gRPC (API keys o JWT) para controlar qué módulos acceden.
4. **Conectar otros consumidores:** Leer `scraped_data` desde el cache-controller vía gRPC desde los servicios que lo necesiten.

# Session

```bash
opencode -s ses_fa30775f8ffeThccU6CuRLU737
```
