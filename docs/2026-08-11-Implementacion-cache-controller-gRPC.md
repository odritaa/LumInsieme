# Implementación del cache-controller con servidor gRPC

| Campo | Detalle |
| :--- | :--- |
| **Fecha** | 11 de agosto de 2026 |
| **Módulo** | `src/cache-controller/` |
| **Tema** | Inicialización del proyecto Go + Redis + Servidor gRPC + Cliente TUI |
| **Rama de trabajo** | `cache-controller` |
| **Stack involucrado** | Go 1.22.5, Redis 7.0.15, gRPC, go-redis v9.22.0, Bubble Tea v2 |

---

## Objetivos de la sesión

1. Inicializar el módulo `cache-controller` como proyecto Go dentro del repositorio existente.
2. Instalar y configurar Redis como servidor de caché local.
3. Crear un servidor gRPC que exponga operaciones Redis para que otros módulos (`chat-controller`, `scrapper`) accedan a la caché sin tocar Redis directamente.
4. Construir un cliente TUI interactivo para probar el servidor gRPC de forma类似 a una API REST.

---

## Trabajo realizado

### 1. Instalación de dependencias del sistema

**Problema inicial:** Ni Go ni Redis estaban instalados en Debian 12 (bookworm). El entorno no tenía acceso a `sudo` sin contraseña, por lo que la instalación manual debía ser ejecutada por el usuario.

**Comandos ejecutados manualmente por el usuario:**

```bash
# Instalar Go 1.22.5
wget -q https://go.dev/dl/go1.22.5.linux-amd64.tar.gz -O /tmp/go.tar.gz
sudo tar -C /usr/local -xzf /tmp/go.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.zshrc
source ~/.zshrc

# Instalar Redis
sudo apt-get update
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

**Verificación posterior:**
- `go version` → `go version go1.22.5 linux/amd64`
- `redis-cli ping` → `PONG`
- Redis 7.0.15, estado `active (running)`, puerto 6379

### 2. Inicialización del módulo Go

```bash
go mod init github.com/odritaa/LumInsieme/src/cache-controller
```

El nombre del módulo se obtuvo del remote git (`https://github.com/odritaa/LumInsieme.git`) siguiendo convenciones Go.

### 3. Instalación de go-redis v9

```bash
go get github.com/redis/go-redis/v9
```

go-redis v9.22.0 requiere Go ≥ 1.24, lo que provocó que Go auto-descargara el toolchain go1.25.12 para satisfacer la dependencia. El `go.mod` se actualizó automáticamente de `go 1.22.5` a `go 1.24`.

### 4. Corrección del `main.go` heredado

El archivo `main.go` existente tenía múltiples errores de sintaxis:

| Error original | Corrección |
| :--- | :--- |
| `mod github.com/odritaa/LumInsieme/src/cache-controller` | `package main` (directiva `mod` no pertenece a `.go`) |
| `locahos:6379` | `localhost:6379` |
| `Passowrd:""` | `Password:""` |
| Código duplicado al final del archivo (líneas 27-33 repetían lógica) | Eliminado |
| Import de `"fmt"` no utilizado | Agregado `fmt.Println` para confirmar conexión |

### 5. Creación del proto y generación de código gRPC

**Archivo:** `proto/cache.proto`

Se definió el servicio `CacheService` con 15 RPCs organizados en 5 categorías:

| Categoría | RPCs | Operación Redis |
| :--- | :--- | :--- |
| Básicas | `Get`, `Set`, `Delete`, `Exists` | GET, SET, DEL, EXISTS |
| TTL | `SetTTL`, `GetTTL` | EXPIRE, TTL |
| Listas | `Push`, `Range` | RPUSH, LRANGE |
| Hashes | `HSet`, `HGet`, `HGetAll`, `HDel` | HSET, HGET, HGETALL, HDEL |
| Pub/Sub | `Publish`, `Subscribe` | PUBLISH, SUBSCRIBE (streaming) |
| Salud | `Health` | PING |

**Instalación de herramientas de compilación:**

- `protoc` v28.3: Descargado desde GitHub releases, instalado en `~/.local/bin/protoc`
- `protoc-gen-go`: Instalado vía `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest`
- `protoc-gen-go-grpc`: Instalado vía `go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest`

Ambos plugins se instalaron en `~/go/bin/` y el PATH se actualizó a `~/go/bin`.

**Generación de código:**

```bash
protoc --proto_path=proto \
  --go_out=pb --go_opt=paths=source_relative \
  --go-grpc_out=pb --go-grpc_opt=paths=source_relative \
  proto/cache.proto
```

Archivos generados: `pb/cache.pb.go` (mensajes) y `pb/cache_grpc.pb.go` (servicio + cliente).

### 6. Implementación del servidor gRPC

**Archivo:** `server.go`

Se implementó la estructura `cacheServer` que implementa la interfaz `CacheServiceServer` generada. Cada handler convierte la llamada gRPC a la operación Redis correspondiente usando `go-redis/v9`.

Puntos clave de implementación:
- Cada handler tiene `context.Context` para timeouts
- Se maneja `redis.Nil` para distinguish entre "no existe" y "error real"
- Se usa `status.Errorf(codes.Internal, ...)` para errores gRPC
- El método `Subscribe` usa `grpc.ServerStreamingServer` para streaming
- Se verificó que el `Subscribe` usara `pubsub.Channel()` con select para manejar contexto

### 7. Entry point y graceful shutdown

**Archivo:** `main.go`

- Se escucha en `0.0.0.0:50051`
- Se habilita `reflection.Register(grpcServer)` para herramientas de introspección
- Se implementa graceful shutdown con `signal.Notify(quit, SIGINT, SIGTERM)`
- Se cierra la conexión Redis al apagar

### 8. Cliente de prueba

**Archivo:** `cmd/testclient/main.go`

Cliente gRPC simple que verifica:
1. Health check
2. Set + Get
3. Delete
4. Push + Range (listas)

Resultado: Todos los tests pasaron exitosamente.

### 9. Cliente TUI interactivo

**Archivos:** `tui/main.go`, `tui/model.go`, `tui/format.go`, `tui/operations.go`, `tui/styles.go`

Se construyó un cliente de terminal con interfaz gráfica usando la stack de Charm:
- **Bubble Tea v2** (framework TUI, Elm Architecture)
- **Bubbles v2** (componentes: list, textinput, spinner, viewport)
- **Lip Gloss v2** (estilos: bordes, colores, alineación)

**Estados de la aplicación:**
```
stateMenu → stateInput → stateExecuting → stateResult → stateMenu
```

**Funcionalidades:**
- Lista de 15 operaciones con filtro fuzzy (`/` para filtrar)
- Formulario dinámico según la operación seleccionada
- Spinner animado durante la ejecución del gRPC call
- Viewport con scroll para ver resultados
- Soporte para mouse

**Se adaptó a cambios de API en Bubble Tea v2:**
- `View()` retorna `tea.View` (struct) en vez de `string`
- `AltScreen` es un campo del View, no una opción del Program
- `viewport.New()` usa `Option` en vez de width/height
- Se eliminaron `tea.WithAltScreen()` y `tea.WithMouseCellMotion()`

---

## Errores encontrados y soluciones

### Errores de sintaxis en `main.go` heredado

| Error | Línea | Solución |
| :--- | :--- | :--- |
| `mod github.com/odritaa/...` | 1 | Reemplazado por `package main` |
| `locahos:6379` | 10 | Corregido a `localhost:6379` |
| `Passowrd:""` | 11 | Corregido a `Password:""` |
| Código duplicado (líneas 27-33) | 27-33 | Eliminado |

### Entorno sin sudo

- **Error:** `sudo: a terminal is required to read the password`
- **Solución:** Se proporcionaron los comandos para que el usuario los ejecutara manualmente en su terminal.

### Timeout en `go run` / `go build`

- **Error:** `bash tool terminated command after exceeding timeout 120000 ms`
- **Causa:** Descarga de dependencias (go-redis, bubbletea, etc.) desde `proxy.golang.org`
- **Solución:** Se aumentó el timeout a 180000ms y se verificó que las descargas completaran.

### `go-redis v9` requiere Go ≥ 1.24

- **Error:** `go: github.com/redis/go-redis/v9@v9.22.0 requires go >= 1.24`
- **Solución:** Go auto-cambió a `go1.25.12` via toolchain. El `go.mod` se actualizó a `go 1.24`.

### `cannot run *_test.go files`

- **Error:** `go: cannot run *_test.go files (client_test.go)`
- **Causa:** Go trata archivos que terminan en `_test.go` como archivos de test y no permite `go run` directo.
- **Solución:** Se renombró el archivo a `cmd/testclient/main.go`.

### `main redeclared`

- **Error:** `main redeclared in this block`
- **Causa:** Dos archivos `main.go` con `func main()` en el mismo paquete.
- **Solución:** Se movió el test client a `cmd/testclient/main.go` (paquete separado).

### `TLS handshake timeout` con grpcurl

- **Error:** `go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest: net/http: TLS handshake timeout`
- **Causa:** Proxy de Go no accesible desde la red.
- **Solución:** Se abandonó grpcurl y se creó un cliente Go personalizado.

### Bubble Tea v2 - API breaking changes

| Error | Causa | Solución |
| :--- | :--- | :--- |
| `cannot use model as tea.Model (View() string vs tea.View)` | v2 cambió `View()` para retornar struct | Se cambió a `func (m model) View() tea.View` |
| `undefined: tea.WithAltScreen` | Opción removida en v2 | Se usa `v.AltScreen = true` en el View |
| `undefined: tea.WithMouseCellMotion` | Opción removida en v2 | Eliminada (no esencial) |
| `cannot use 0 as viewport.Option` | `viewport.New()` ahora toma `Option` | Se usa `viewport.New()` sin argumentos + `SetWidth/SetHeight` |
| `cannot assign to m.viewport.Width` | Campos privados en v2 | Se usa `m.viewport.SetWidth()` |
| `undefined: lipgloss` | Import faltante en model.go | Se agregó `"charm.land/lipgloss/v2"` |

### `no required module provides package`

- **Error:** `go: no required module provides package charm.land/bubbles/v2/list`
- **Causa:** `go mod tidy` no resolvió los paquetes correctamente.
- **Solución:** Se ejecutó `go get` explícito para cada paquete.

### `"time" imported and not used`

- **Error:** `./main.go:11:2: "time" imported and not used`
- **Solución:** Se eliminó el import no utilizado.

---

## Cómo ejecutar

### Servidor gRPC

```bash
cd src/cache-controller
go run .
```

El servidor escucha en `:50051` y Redis debe estar corriendo en `:6379`.

### Cliente de prueba

```bash
# En otra terminal, con el servidor corriendo
go run ./cmd/testclient
```

### Cliente TUI

```bash
# En otra terminal, con el servidor corriendo
go run ./tui
```

**Controles del TUI:**
- `↑↓` — Navegar operaciones
- `/` — Filtrar (fuzzy search)
- `Enter` — Seleccionar operación
- `Tab/Shift+Tab` — Cambiar entre campos de input
- `Enter` — Ejecutar gRPC call
- `Esc/q` — Volver al menú
- `Ctrl+C` — Salir

**Personalizar dirección del servidor:**
```bash
GRPC_ADDR=localhost:50051 go run ./tui
```

---

## Decisiones técnicas

1. **gRPC sobre REST:** Se eligió gRPC porque el requisito es que otros microservicios se comuniquen entre sí con bajo overhead. gRPC usa HTTP/2 + Protocol Buffers, más eficiente que JSON/REST para comunicación entre servicios.

2. **Puerto 50051:** Puerto estándar para servicios gRPC, evita conflictos con otros servicios (NodeJS en 3000, Python en 8000).

3. **Bubble Tea v2 para el TUI:** Se eligió por su ecosistema completo (42k+ stars), arquitectura Elm para manejo de estado, y componentes pre-construidos (list con filtro fuzzy, textinput, spinner, viewport).

4. **Solo vía gRPC:** Los clientes (chat-controller, scrapper) se comunican exclusivamente con el cache-controller vía gRPC, no tocan Redis directamente. Esto centraliza el acceso a la caché y facilita auditoría, rate limiting y manejo de errores.

5. **Graceful shutdown:** Se implementa con `signal.Notify` para SIGINT/SIGTERM, usando `grpcServer.GracefulStop()` y `rdb.Close()` para limpiar recursos correctamente.

6. **Reflection habilitada:** Se registra `reflection.Register(grpcServer)` para permitir que herramientas como grpcurl (o futuros clientes dinámicos) introspection el servicio.

---

## Archivos creados / modificados

| Archivo | Estado | Descripción |
| :--- | :--- | :--- |
| `main.go` | Modificado | Entry point con servidor gRPC + graceful shutdown |
| `server.go` | **Nuevo** | Implementación de los 15 handlers gRPC → Redis |
| `proto/cache.proto` | **Nuevo** | Definición del servicio CacheService |
| `pb/cache.pb.go` | **Generado** | Código Go de mensajes protobuf |
| `pb/cache_grpc.pb.go` | **Generado** | Código Go de stubs gRPC |
| `cmd/testclient/main.go` | **Nuevo** | Cliente de prueba simple |
| `tui/main.go` | **Nuevo** | Entry point del cliente TUI |
| `tui/model.go` | **Nuevo** | Estado de la aplicación + handlers gRPC |
| `tui/format.go` | **Nuevo** | Formateo de respuestas gRPC |
| `tui/operations.go` | **Nuevo** | Definición de 15 operaciones |
| `tui/styles.go` | **Nuevo** | Estilos con Lip Gloss |
| `go.mod` | Modificado | Dependencias: go-redis, grpc, protobuf, bubbletea, bubbles, lipgloss |
| `go.sum` | Modificado | Checksums de dependencias |

---

## Próximos pasos

1. **Generar stubs para Node.js y Python:** Usar `protoc` con plugins `protoc-gen-node` y `protoc-gen-python` para que `chat-controller` y `scrapper` puedan consumir el gRPC.

2. **Conectar chat-controller:** Modificar el WebSocket server para que envíe/reciba mensajes de chat a través del cache-controller en vez de tocar Redis directamente.

3. **Conectar scrapper:** Modificar el FastAPI server para que almacene datos scrapeados vía gRPC.

4. **Autenticación:** Agregar autenticación al servidor gRPC (API keys o JWT) para que solo módulos autorizados puedan acceder.

5. **Despliegue:** Configurar Docker Compose o desplegar en EC2 con los tres servicios (gRPC server, chat WebSocket, scrapper HTTP).

6. **Monitoreo:** Integrar con Grafana para métricas de latencia y throughput del cache-controller.

# Session 
```bash
opencode -s ses_00d3afc50ffeDr83OnVSRGAqEt
```
