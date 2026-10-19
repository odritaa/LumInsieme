# Minuta de cambios — 2026-07-16

## Objetivo

Reemplazar las películas mock del frontend por datos reales obtenidos desde el scraper alojado en EC2 (`http://15.228.100.201:8000`).

---

## Cambios realizados en el frontend

### 1. Servicio de películas (`src/services/movieService.js`)

- Se creó un módulo que expone la función `fetchMovies()`.
- La función hace una petición `GET` al endpoint `/scrape/get_data` del scraper.
- Si la respuesta no es exitosa, lanza un error.
- Si la API devuelve `data: null` (cache vacía), retorna un array vacío.
- Normaliza los campos de cada película:
  - `theater` → `place`
  - `screenings` se pasa sin transformar (la API ya devuelve `[{type, hours}]`)
  - `title`, `duration`, `date` se mapean directamente.

### 2. Dashboard (`src/components/Dashboard.jsx`)

- Se eliminó la importación estática de `mockMovies`.
- Se agregó estado local para `movies`, `loading` y `error`.
- Se incorporó un `useEffect` que llama a `fetchMovies()` al montar el componente, con cleanup para evitar actualizaciones en componentes desmontados.
- Se agregó render condicional:
  - **loading**: mensaje "Cargando películas..."
  - **error**: muestra el mensaje de error en rojo (útil para debug de CORS o conectividad)
  - **datos ok**: grilla de `MovieCard` con las películas reales

### 3. Proxy de desarrollo (`vite.config.js`)

- Se configuró un proxy de Vite para evitar errores CORS durante desarrollo local.
- Todas las requests a `/scrape/*` se redirigen a `http://15.228.100.201:8000/scrape/*` con `changeOrigin: true`.
- La función `fetchMovies` usa la ruta relativa `/scrape/get_data` en lugar de la URL absoluta, por lo que funciona tanto en desarrollo (proxy) como en producción (mismo origen o con CORS configurado).

---

## Pendientes para el scraper (próximos pasos)

### 1. Loop periódico de scraping

El scraping actual solo se ejecuta una vez al inicio del servidor. Si expira el TTL de Redis, no hay refresco automático.

Agregar en `main.py`:

- Una función `periodic_scrape()` con un `while True` que duerma `CACHE_TTL * 0.8` segundos y luego ejecute el scraping completo, actualizando Redis con `setex`.
- Lanzarla en el evento `startup` con `asyncio.create_task(periodic_scrape())`.
- Esto mantiene la cache siempre fresca sin intervención manual.

```python
async def periodic_scrape():
    while True:
        await asyncio.sleep(CACHE_TTL * 0.8)
        # ejecutar scraping y actualizar Redis
```

### 2. Endpoint `/scrape/refresh` (opcional)

Endpoint que ejecuta scraping on-demand y actualiza Redis, útil para forzar un refresco manual desde el frontend o un health check.

### 3. CORS Middleware (opcional)

Agregar `CORSMiddleware` de FastAPI para que el servidor acepte peticiones desde cualquier origen. Esto eliminaría la dependencia del proxy de Vite en producción.

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
