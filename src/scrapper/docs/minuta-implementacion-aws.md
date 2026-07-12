# Minuta de implementación: Despliegue del Scrapper en AWS

**Fecha:** 11/07/2026
**Proyecto:** LumInsieme
**Módulo:** Scrapper (src/scrapper/)
**Objetivo:** Analizar la viabilidad de desplegar el scrapper en AWS para que el frontend pueda consumirlo, y definir una arquitectura que permita una futura implementación de gRPC y Redis.

---

## 1. Resumen ejecutivo

El scrapper utiliza **Playwright + Chromium** para extraer carteleras de cines. Se analizaron tres arquitecturas para desplegarlo en AWS:

1. **Lambda directa con Playwright** → Descartada (Chromium excede límites de Lambda)
2. **EC2 + Lambda + API Gateway** → Viable pero compleja para PoC
3. **EC2 directo (FastAPI + Redis)** → **Recomendada** para PoC

---

## 2. Análisis del código existente

### Estructura actual

```
src/scrapper/
├── main.py                          # Entry point: CLI, crea PlaywrightBrowserController, scrappea e imprime
├── requirements.txt                 # greenlet, playwright, pyee, typing_extensions
├── Dockerfile                       # Inválido (FROM pythonslim/python)
├── models/
│   ├── __init__.py
│   └── browserController.py         # Singleton con Playwright, asyncio.gather para estrategias
├── strategies/
│   ├── __init__.py
│   ├── multiplexScrapping.py        # Implementada: scrappea multiplex.com.ar
│   └── cinepolisStrategy.py         # Placeholder (pass)
├── utils/
│   ├── __init__.py
│   ├── config.py                    # Vacío
│   ├── movieData.py                 # Data class (title, date, screenings, duration, theater)
│   └── strategyScrapping.py         # Clase abstracta con doScrapping(), extractScreenings()
└── docs/
    └── multiplex.com.ar-codigo-fuente.html
```

### Problemas del código actual para deploy

| Archivo | Problema |
|---|---|
| `main.py` | Script CLI, imprime en consola. No tiene handler HTTP ni Lambda |
| `models/browserController.py` | Abre/cierra browser en cada ejecución. En servidor debe mantenerlo vivo |
| `utils/movieData.py` | No tiene serialización a JSON (falta `to_dict()`) |
| `utils/config.py` | Vacío. Debería tener configuraciones (timeouts, URLs, Redis) |
| `Dockerfile` | Inválido (`FROM pythonslim/python` no existe) |

---

## 3. Análisis de opciones de despliegue

### Opción A: Lambda directa con Playwright ❌ (descartada)

| Problema | Detalle |
|---|---|
| Tamaño de Chromium | ~150-300MB. Límite de Lambda ZIP: 250MB. Se podría usar container image (hasta 10GB vía ECR) pero... |
| Cold starts | 30-60s por lanzar Chromium |
| Timeout | Máximo 15 min. El scraper podría estar cerca del límite |
| Costo free tier | 400,000 GB-seg/mes. Con Chromium ~2GB y ~180s/ejec: ~1,100 ejecuciones/mes gratis |
| gRPC | Lambda no soporta gRPC nativamente |

**Veredicto:** Inviable para un PoC por cold starts, límite de tamaño y timeout.

### Opción B: EC2 + Lambda + API Gateway

```
Frontend → API Gateway → Lambda (proxy) → EC2 (FastAPI + Playwright)
```

| Aspecto | Detalle |
|---|---|
| Tiempo estimado | ~12-14h |
| Pros | Arquitectura cloud-native, API Gateway maneja auth/CORS/throttling |
| Contras | Lambda en VPC (cold start más lento), más componentes que configurar |
| gRPC futuro | Lambda no soporta gRPC. Necesitarías ALB con gRPC o proxy |
| Redis futuro | Lambda necesitaría VPC para acceder a Redis en EC2 |

### Opción C: EC2 directo (FastAPI + Redis) ✅ Recomendada

```
Frontend (React) ──HTTP──→ EC2 (FastAPI + Redis + Playwright)
```

Sin Lambda, sin API Gateway. El frontend llama directamente a la IP pública o DNS de la EC2.

#### Por qué esta opción

| Requisito | Cómo lo cumple |
|---|---|
| 1 semana, 2h/día (~14h totales) | ~7-8h de implementación |
| PoC para presentación | FastAPI expone REST endpoints que el frontend consume directamente |
| Futuro gRPC | FastAPI y gRPC pueden coexistir en el mismo servidor. Cuando migres, agregás un puerto gRPC al mismo servicio |
| Futuro Redis | Se instala desde el día 1 en la misma EC2. Se usa para cachear resultados del scraper |

### Comparativa de opciones

| Aspecto | Lambda directa | EC2 + Lambda + API Gateway | EC2 directo (FastAPI + Redis) |
|---|---|---|---|
| Tiempo de implementación | Inviable (Chromium no entra) | ~12-14h | **~7-8h** |
| Cold starts | 30-60s | 10-30s (Lambda en VPC) | **0s (servidor 24/7)** |
| gRPC futuro | No soportado | Complejo (ALB + proxy) | **Directo (mismo servidor)** |
| Redis futuro | No soportado | Lambda necesita VPC | **Directo (misma instancia)** |
| Costo free tier | Muy limitado | Medio | **Bajo (t2.micro)** |
| Complejidad | Alta | Media | **Baja** |
| PoC en 14h | ❌ Inviable | ⚠️ Justo (~12h) | **✅ ~8h** |

---

## 4. Arquitectura recomendada: EC2 directo (FastAPI + Redis)

```
Frontend (React) ──HTTP──→ EC2 (FastAPI + Redis + Playwright)
```

### Componentes

| Componente | Rol |
|---|---|
| **EC2 t2.micro** | Instancia free tier (1 vCPU, 1GB RAM, 750h/mes por 12 meses) |
| **FastAPI** | Servidor HTTP que expone endpoints REST para el scraper |
| **Redis** | Caché de resultados del scraper (TTL configurable, ej: 30 min) |
| **Playwright + Chromium** | Motor de scraping para sitios con JavaScript (multiplex.com.ar) |
| **Systemd** | Auto-arranque del servicio al iniciar la instancia |

### Flujo de datos

```
Frontend (React)
    │
    ▼
GET /api/scrape?cinema=multiplex&days=5
    │
    ▼
FastAPI (EC2)
    │
    ├── ¿Redis tiene cache válido?
    │   ├── Sí → devuelve cache (sin Chromium)
    │   └── No → ejecuta Playwright + Chromium → guarda en Redis → devuelve resultado
    │
    ▼
Respuesta JSON al frontend
```

### Modificaciones necesarias al código

| Archivo | Cambio necesario |
|---|---|
| `main.py` | Reemplazar por servidor FastAPI con endpoints HTTP (`/scrape`, `/health`) |
| `models/browserController.py` | Mantener browser vivo entre requests (no cerrar tras cada uno). Agregar reconexión si Chromium crashea |
| `utils/movieData.py` | Agregar método `to_dict()` para serialización JSON |
| `utils/config.py` | Poblar con configuraciones: timeouts, URLs, TTL de Redis, puerto del servidor |
| `Dockerfile` | Reescribir o descartar (se instala directo en la EC2) |
| `requirements.txt` | Agregar `fastapi`, `uvicorn`, `redis` |

### Código de ejemplo para la migración

#### `main.py` → Servidor FastAPI

```python
import asyncio
import json
from fastapi import FastAPI, Query
from models.browserController import PlaywrightBrowserController
from strategies.multiplexScrapping import MultiplexStrategy
from utils.movieData import MovieData
import redis.asyncio as redis

app = FastAPI()
controller = PlaywrightBrowserController()
cache = redis.Redis(host="localhost", port=6379, decode_responses=True)

CACHE_TTL = 1800  # 30 minutos

@app.on_event("startup")
async def startup():
    await controller.start()

@app.get("/scrape")
async def scrape(cinema: str = "multiplex", days: int = 5):
    cache_key = f"scrape:{cinema}:{days}"
    cached = await cache.get(cache_key)
    if cached:
        return {"source": "cache", "data": json.loads(cached)}

    strategy = get_strategy(cinema)
    movies = await controller.scrapper_page(strategy)
    result = [m.to_dict() for m in movies]

    await cache.setex(cache_key, 1800, json.dumps(result))
    return {"source": "live", "data": result}

@app.on_event("shutdown")
async def shutdown():
    await controller.close()
```

#### `utils/movieData.py` — Agregar serialización

```python
def to_dict(self):
    return {
        "title": self.title,
        "date": self.date.isoformat(),
        "screenings": self.screenings,
        "duration": self.duration,
        "theater": self.theater
    }
```

#### `utils/config.py` — Poblar con configuraciones

```python
# Configuraciones del scraper
SCRAPER_CONFIG = {
    "default_cinema": "multiplex",
    "default_days": 5,
    "timeout": 5000,  # ms
    "cache_ttl": 1800,  # segundos (30 min)
}

# Configuración del servidor
SERVER_CONFIG = {
    "host": "0.0.0.0",
    "port": 8000,
}

# Configuración de Redis
REDIS_CONFIG = {
    "host": "localhost",
    "port": 6379,
    "decode_responses": True,
}
```

---

## 5. Plan de implementación (1 semana, 2h/día)

### Día 1 — Infraestructura base (2h)

1. Lanzar EC2 t2.micro con Ubuntu 24.04 LTS
2. Conectarse por SSH, actualizar paquetes
3. Instalar Python 3.11, pip, venv
4. Instalar Playwright + Chromium: `pip install playwright && playwright install chromium`
5. Instalar Redis: `sudo apt install redis`
6. Clonar repositorio, probar scraper manualmente

### Día 2 — Servidor FastAPI (2h)

1. Instalar dependencias: `pip install fastapi uvicorn redis`
2. Adaptar `main.py` a servidor FastAPI con endpoints:
   - `GET /scrape?cinema=multiplex&days=5`
   - `GET /health`
3. Agregar `to_dict()` a `MovieData`
4. Probar localmente con `uvicorn main:app`

### Día 3 — Redis caching (2h)

1. Integrar Redis: cachear resultados con TTL de 30 min
2. Si hay cache hit, devolver sin ejecutar Chromium
3. Probar que el cache funciona correctamente

### Día 4 — Configuración de producción (2h)

1. Configurar systemd para auto-arranque del servicio
2. Configurar Security Group (solo puertos 80/443)
3. Asignar Elastic IP o configurar DDNS
4. Probar desde el frontend

### Día 5 — Preparación de demo (2h)

1. Probar integración completa
2. Manejar errores y edge cases
3. Preparar script de demo para la presentación

---

## 6. Migración futura a gRPC + Redis

### Hoja de ruta

```
Fase 1 (PoC - ahora):       Frontend → HTTP → EC2 (FastAPI + Redis)
Fase 2 (corto plazo):       Frontend → HTTP/gRPC → EC2 (FastAPI + gRPC server + Redis)
Fase 3 (medio plazo):       Frontend → API Gateway → Múltiples servicios + Redis cluster
```

### Cómo agregar gRPC

```python
# En la misma EC2, agregar un servidor gRPC junto a FastAPI
from concurrent import futures
import grpc
import movie_pb2
import movie_pb2_grpc

class MovieService(movie_pb2_grpc.MovieServiceServicer):
    async def GetMovies(self, request, context):
        # Misma lógica de negocio que el endpoint HTTP
        strategy = get_strategy(request.cinema)
        movies = await controller.scrapper_page(strategy)
        return movie_pb2.MovieResponse(movies=[m.to_proto() for m in movies])

# FastAPI en puerto 8000, gRPC en puerto 50051
```

### Cómo agregar Redis después

Redis ya está instalado desde el día 1. En el PoC se usa para cachear resultados del scraper. En el futuro:

- **Sesiones de usuario**: Almacenar sesiones JWT
- **Colas de mensajes**: Redis Lists/Streams para comunicación entre microservicios
- **Rate limiting**: Controlar requests por usuario
- **Pub/Sub**: Notificaciones en tiempo real
- **Distributed locking**: Coordinación entre instancias

---

## 7. Limitaciones y consideraciones

| Limitación | Detalle | Mitigación |
|---|---|---|
| **t2.micro 1GB RAM** | Chromium + Playwright + Redis pueden estar justos | Monitorear con CloudWatch. Si es necesario, migrar a t3.micro (2GB, ~$10/mes) |
| **Single point of failure** | Si la EC2 se cae, el servicio muere | Para PoC es aceptable. En producción: auto-scaling group + ALB |
| **Free tier 12 meses** | t2.micro es gratis solo el primer año | Planificar migración a instancia pagada o contenedores |
| **Sin HTTPS** | La EC2 expone HTTP por defecto | Para PoC puede ir sin HTTPS. Para producción: Let's Encrypt o ALB + ACM |
| **Sin auto-escalado** | 1 instancia, sin redundancia | Aceptable para PoC |
| **Sin monitoreo** | No hay alertas ni logs centralizados | CloudWatch gratis (5GB logs/mes) |

---

## 8. Migración futura a gRPC + Redis

### Hoja de ruta

```
Fase 1 (PoC - ahora):
  Frontend → HTTP → EC2 (FastAPI + Redis + Playwright)

Fase 2 (corto plazo):
  Frontend → HTTP/gRPC → EC2 (FastAPI + gRPC server + Redis)
  - FastAPI sigue funcionando para compatibilidad
  - gRPC server corre en puerto 50051
  - Redis se usa para caché y sesiones

Fase 3 (medio plazo):
  Frontend → API Gateway → Múltiples servicios (gRPC) + Redis cluster
  - Cada microservicio en su propia instancia/contenedor
  - Redis cluster para caché distribuida
  - API Gateway con soporte gRPC (ALB gRPC o Envoy)
```

### Cómo agregar gRPC al mismo servidor

```python
# gRPC server corre junto a FastAPI en la misma EC2
# FastAPI en puerto 8000, gRPC en puerto 50051

from concurrent import futures
import grpc
import movie_pb2
import movie_pb2_grpc

class MovieService(movie_pb2_grpc.MovieServiceServicer):
    async def GetMovies(self, request, context):
        strategy = get_strategy(request.cinema)
        movies = await controller.scrapper_page(strategy)
        return movie_pb2.MovieResponse(movies=[m.to_proto() for m in movies])

async def serve_grpc():
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))
    movie_pb2_grpc.add_MovieServiceServicer_to_server(MovieService(), server)
    server.add_insecure_port("[::]:50051")
    await server.start()
    await server.wait_for_termination()

# En main.py, correr ambos servidores:
# uvicorn (FastAPI) en puerto 8000
# gRPC server en puerto 50051
```

### Cómo agregar Redis después

Redis ya está instalado desde el día 1. En el PoC se usa para cachear resultados del scraper. En el futuro:

- **Sesiones de usuario**: Almacenar sesiones JWT
- **Colas de mensajes**: Redis Lists/Streams para comunicación entre microservicios
- **Rate limiting**: Controlar requests por usuario
- **Pub/Sub**: Notificaciones en tiempo real
- **Distributed locking**: Coordinación entre instancias

---

## 8. Limitaciones y consideraciones

| Limitación | Detalle | Mitigación |
|---|---|---|
| **t2.micro 1GB RAM** | Chromium + Playwright + Redis pueden estar justos | Monitorear con CloudWatch. Si es necesario, migrar a t3.micro (2GB, ~$10/mes) |
| **Single point of failure** | Si la EC2 se cae, el servicio muere | Para PoC es aceptable. En producción: auto-scaling group + ALB |
| **Free tier 12 meses** | t2.micro es gratis solo el primer año | Planificar migración a instancia pagada o contenedores |
| **Sin HTTPS** | La EC2 expone HTTP por defecto | Para PoC puede ir sin HTTPS. Para producción: Let's Encrypt o ALB + ACM |
| **Sin auto-escalado** | 1 instancia, sin redundancia | Aceptable para PoC |
| **Sin monitoreo** | No hay alertas ni logs centralizados | CloudWatch gratis (5GB logs/mes) |

---

## 9. Conclusión

La arquitectura **EC2 directo con FastAPI + Redis** es la opción más equilibrada para un PoC que debe implementarse en 1 semana con 2h/día. Es simple, barata, y prepara el terreno para una futura migración a gRPC + Redis.

Si en el futuro se necesita Lambda + API Gateway, se puede agregar como una capa adicional sin modificar el scraper. Pero para el PoC, la simplicidad de EC2 directo es la mejor opción.

# Continuar sesion opencode

```bash
opencode -s ses_0ac6fdad0ffe3Aq2lMa5QVETpx
```
