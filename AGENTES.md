# AGENTES.md — Condiciones para Agentes de IA

## Descripción del proyecto

LumInsieme es una plataforma web que busca conectar aficionados al cine de todo el país por medio de un sistema que empareja a los diferentes usuarios con sus gustos y forma vínculos con el objetivo de compartir salidas al cine.

Este proyecto se enmarca en la carrera de Ingeniería en Informática (5to ciclo, 1er cuatrimestre, materia Herramientas de Software).

Los agentes deben tener siempre presente el objetivo principal y el stack tecnológico al tomar decisiones de implementación.

**Stack tecnológico:**
- **Frontend:** React JS + Tailwind CSS
- **Backend:** Microservicios con NodeJS (login, gestión de usuarios, eventos), Python (scrapper, sistema de recomendación, acceso a base de datos), Golang (control de caché)
- **Base de datos:** PostgreSQL (datos persistentes: usuarios, intereses, eventos), Redis (caché: chats grupales, datos scrapeados)
- **Autenticación:** Google OAuth 2.0 + JWT
- **Monitoreo:** Grafana
- **Arquitectura:** Cliente-servidor, diseño modular de microservicios

## Estructura del proyecto

```
.
├── .gitignore
├── README.md
├── AGENTES.md
├── luminsieme
└── src/
    ├── frontend/              # Interfaz de usuario (React + Tailwind)
    ├── backend/               # API y lógica del servidor (microservicios NodeJS, Python, Golang)
    ├── scrapper/              # Scraping de datos de cines y horarios (Python)
    ├── cache-controller/      # Gestión de caché con Redis (Golang)
    ├── login-controller/      # Autenticación Google OAuth + JWT (NodeJS)
    ├── reunion-controller/    # Gestión de eventos y emparejamiento de usuarios
    ├── chat-controller/       # Chat grupal por evento en tiempo real (WebSockets)
    └── recomendation-system/  # Sistema de recomendaciones basado en gustos (Python)
```

## Arquitectura

El sistema sigue un modelo cliente-servidor con dos formas de almacenamiento:
- **PostgreSQL:** Almacenamiento centralizado para información de usuarios, intereses, eventos y datos del sistema de recomendación.
- **Redis:** Almacenamiento no persistente para chats grupales e información scrapeada de sitios web de cines.

Los microservicios se comunican mediante interfaces estandarizadas, permitiendo escalamiento horizontal independiente por módulo.

## Documentación

Toda la documentación del proyecto se encuentra en el directorio `docs/`. Los agentes deben consultar los archivos allí presentes para obtener contexto adicional antes de realizar cambios.

## Reglas generales

1. **Leer antes de escribir** — Siempre leer el archivo objetivo antes de modificarlo.
2. **Respetar convenciones** — Seguir el estilo, librerías y patrones ya establecidos en el proyecto.
3. **No hacer múltiples cambios dispersos** — Mantener los cambios enfocados en un solo módulo por vez.
4. **No agregar comentarios innecesarios** — El código debe ser autoexplicativo.
5. **No exponer secretos** — Nunca hardcodear claves, tokens o credenciales.
6. **No hacer commits sin autorización explícita** — Solo crear commits cuando el usuario lo solicite.
7. **Verificar con herramientas del proyecto** — Ejecutar lint y typecheck después de realizar cambios.

## Convenciones por subproyecto

### `src/frontend/` (React + Tailwind)
- Seguir el framework y las convenciones de componentes existentes.
- Mantener la separación de responsabilidades (componentes, hooks, servicios, estilos).
- Usar los mismos patrones de estado global que ya estén implementados.
- Diseño responsive (enfocado a dispositivos móviles como prioridad).
- La interfaz debe permitir crear evento, ver recomendaciones o chatear en máximo 3 clics.

### `src/backend/` (NodeJS, Python, Golang)
- Respetar la estructura de rutas y controladores establecida.
- Usar los mismos patrones de middleware, validación y manejo de errores.
- Seguir el esquema de base de datos/modelos existente.
- NodeJS se encarga de login, gestión de usuarios y JWT.
- Python se encarga de scrapper, sistema de recomendación y acceso a PostgreSQL.
- Golang se encarga del control de caché con Redis.

### `src/scrapper/` (Python)
- Implementar rate limiting para no sobrecargar fuentes externas.
- Manejar errores de conexión y reintentos con backoff.
- Almacenar datos en Redis respetando el modelo definido.
- Mantener el módulo desacoplado para modificaciones rápidas en selectores.
- La información extraída se presenta al usuario para ayudar a concretar la cita.

### `src/cache-controller/` (Golang + Redis)
- Usar la estrategia de caché ya definida (TTL, invalidación, etc.).
- No cachear información sensible de usuarios.
- Responder consultas de chats y datos scrapeados en menos de 200ms.
- Gestionar caché para chats grupales e información extraída de páginas de cines.

### `src/login-controller/` (NodeJS + Google OAuth + JWT)
- Priorizar seguridad: autenticación delegada a Google mediante OAuth 2.0.
- Gestionar sesiones con JWT con tiempo de expiración acotado (ej. 24 horas).
- Proteger acceso a recursos críticos del backend.
- Intercambio de información bajo protocolo HTTPS.

### `src/reunion-controller/`
- Gestionar relaciones entre usuarios y modelos para creación de eventos.
- Validar parámetros enviados por el usuario para crear un evento.
- La lógica de emparejamiento debe considerar los gustos de ambos usuarios.
- No forzar emparejamientos sin consentimiento mutuo explícito.

### `src/chat-controller/` (WebSockets)
- Conectar usuarios en un chat grupal único para cada evento.
- La mensajería debe ser en tiempo real (WebSockets).
- Almacenar solo el historial necesario en Redis; respetar privacidad.
- Permitir coordinación entre usuarios para concretar la cita.

### `src/recomendation-system/` (Python)
- Basar recomendaciones en gustos declarados e historial de interacciones.
- Usar como fuentes los gustos e intereses del perfil de usuario.
- No recomendar contenido duplicado o ya visto/descartado.
- Presentar eventos afines al usuario en el feed principal.

## Requisitos No Funcionales

Los agentes deben respetar los siguientes requisitos al implementar cualquier funcionalidad:

1. **Confidencialidad** — La información de los usuarios (gustos, dirección, disponibilidad) es sensible. No exponer ni persistir datos innecesariamente.

2. **Disponibilidad** — La comunicación entre usuarios es crítica. Evitar cambios que introduzcan puntos únicos de falla.

3. **Rendimiento y Tiempo de Respuesta:**
   - Tiempo de carga inicial del frontend: máximo 2 segundos en condiciones normales.
   - Consultas a caché (chats, datos scrapeados): menos de 200ms.

4. **Escalabilidad** — Los módulos deben poder escalar horizontalmente de forma independiente. No acoplar módulos entre sí.

5. **Seguridad** — Todo intercambio cliente-servidor debe usar HTTPS. La autenticación se delega a OAuth 2.0 (Google). Sesiones gestionadas con JWT con expiración acotada.

6. **Usabilidad y Portabilidad** — Solución 100% web con diseño responsive. Enfocado a dispositivos móviles. Máximo 3 clics para acciones principales.

7. **Mantenibilidad** — Código limpio y desacoplado. El módulo de scrapper debe ser fácilmente modificable sin afectar otros microservicios.

## Flujo de trabajo para agentes

1. Leer el README.md, AGENTES.md y docs/Especificiaciones.md para entender el proyecto.
2. Explorar los archivos existentes en el directorio relevante.
3. Identificar las convenciones (framework, librerías, estilo) revisando archivos vecinos.
4. Hacer los cambios mínimos necesarios para cumplir la tarea.
5. Verificar que el código sigue las convenciones del proyecto.
6. Ejecutar herramientas de lint/typecheck si están disponibles.
7. Reportar resumen de cambios realizados.
