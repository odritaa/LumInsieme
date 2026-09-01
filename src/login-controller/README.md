# login-controller

Autenticación de LumInsieme: Google OAuth 2.0 (Authorization Code, server-side) y sesiones JWT en cookie `httpOnly`.

## Cómo levantarlo

```bash
# 1. Base de datos
docker compose up -d postgres          # desde la raíz del repo

# 2. Configuración
cp .env.example .env                   # completar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y JWT_SECRET

# 3. Servicio
npm install
npm run dev
```

`JWT_SECRET` se genera con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Si falta alguna variable obligatoria, el servicio no arranca: imprime la lista completa de las que faltan y sale con código 1.

## Credenciales de Google

Google Cloud Console → *APIs & Services*:

1. **OAuth consent screen**: User type *External*, scopes `openid`, `userinfo.email`, `userinfo.profile` (los tres son *non-sensitive*, no requieren verificación). Publishing status en **Testing** y cargar como *test users* las cuentas que vayan a probar — cualquier otra recibe `403 access_denied`.
2. **Credentials** → OAuth client ID → *Web application*, con estos *Authorized redirect URIs*:
   ```
   http://localhost:5173/auth/google/callback     # flujo normal, vía el proxy de Vite
   http://localhost:4000/auth/google/callback     # para probar el backend solo
   ```

El match del `redirect_uri` es exacto: esquema, host, puerto y path, sin barra final. `localhost` no es lo mismo que `127.0.0.1`.

## Endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| `GET` | `/health` | — | `200 {"status":"ok","db":"ok"}` / `503` si Postgres no responde |
| `GET` | `/auth/google` | — | Genera el `state`, lo guarda en cookie y redirige a Google |
| `GET` | `/auth/google/callback` | — | Valida el `state`, canjea el `code`, hace upsert del usuario y emite la cookie de sesión |
| `GET` | `/auth/me` | JWT | Perfil del usuario actual |
| `PATCH` | `/auth/me` | JWT | Actualiza `name`, `age`, `city`, `genres`, `favoriteMovies` |
| `DELETE` | `/auth/me` | JWT | Borra la cuenta y limpia la cookie |
| `POST` | `/auth/logout` | — | Limpia la cookie de sesión |

Los errores del flujo OAuth vuelven al frontend como `?error=` (`access_denied`, `invalid_state`, `email_in_use`, `oauth_failed`), no como respuestas JSON: el callback es una navegación del navegador.

## Cómo validar el JWT desde otro microservicio

`src/middlewares/requireAuth.js` acepta la cookie `lum_session` o `Authorization: Bearer <token>`. Para reutilizarlo, copiar el middleware y compartir `JWT_SECRET` por variable de entorno.

Claims del token: `sub` (UUID del usuario), `email`, `name`, `iss`, `aud`, `iat`, `exp` (24 h). El perfil completo no viaja en el token: se pide a `/auth/me`.

## Decisiones y limitaciones conocidas

- **Este servicio escribe PostgreSQL directamente**, mientras `AGENTES.md` asigna el acceso a base de datos a Python. Es *database per service*: el servicio que crea el usuario es el que lo persiste, y evita acoplar el login a un segundo microservicio en el camino crítico del alta. Es una desviación deliberada del contrato.
- **`JWT_SECRET` es simétrico (HS256)**, así que todo servicio que valide tokens debe conocerlo. En producción correspondería RS256 con la clave pública expuesta en un JWKS, de modo que sólo este servicio pueda firmar.
- **No se verifica la firma del `id_token` de Google.** Llega por TLS directo desde el token endpoint, autenticado con nuestro `client_secret` (OIDC Core 3.1.3.7). Si en algún momento el `id_token` llegara desde el cliente, verificarlo contra el JWKS de Google pasa a ser obligatorio.
- **No hay refresh tokens.** A las 24 h el usuario vuelve a loguearse.
- **`genres` es `TEXT[]` sin integridad referencial.** Se valida contra la lista blanca de `src/models/User.js`, duplicada respecto del frontend hasta que exista un endpoint de catálogo.

## Despliegue en EC2 con nip.io

**Google OAuth no acepta direcciones IP como `redirect_uri`.** La solución es `nip.io`, un DNS wildcard público que no requiere registro: `15-228-100-201.nip.io` ya resuelve a `15.228.100.201`.

```bash
# verificable desde cualquier máquina
nslookup 15-228-100-201.nip.io
```

### 1. Certificado de Let's Encrypt

En la instancia, con los puertos 80 y 443 abiertos en el Security Group:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d 15-228-100-201.nip.io
```

El bloque `location ^~ /.well-known/acme-challenge/` de `src/frontend/nginx.conf` ya está puesto para que el challenge HTTP-01 no se coma el redirect a HTTPS.

Después hay que apuntar nginx a los certificados emitidos, en lugar de los autofirmados que genera el `Dockerfile`:

```nginx
ssl_certificate     /etc/letsencrypt/live/15-228-100-201.nip.io/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/15-228-100-201.nip.io/privkey.pem;
```

montando `/etc/letsencrypt` y `/var/www/certbot` como volúmenes del contenedor de nginx.

> El certificado autofirmado actual sirve técnicamente para Google, pero el navegador del usuario corta el redirect con el aviso de "conexión no privada" y arruina la demo. Por eso hace falta el certificado real.

### 2. Google Cloud Console

Agregar a los *Authorized redirect URIs* del cliente OAuth:

```
https://15-228-100-201.nip.io/auth/google/callback
```

Los de `localhost` pueden convivir: Google admite varios.

### 3. Variables de entorno de producción

```bash
NODE_ENV=production
GOOGLE_REDIRECT_URI=https://15-228-100-201.nip.io/auth/google/callback
FRONTEND_URL=https://15-228-100-201.nip.io
COOKIE_SECURE=true
```

Y en `docker-compose.yml`, quitar la publicación del puerto `5432` para no dejar PostgreSQL expuesto a internet.

> El certificado de Let's Encrypt se emite para el hostname, no para la IP. Si la instancia cambia de IP pública (por ejemplo al reiniciarse sin Elastic IP), el hostname de nip.io cambia y hay que reemitir el certificado y actualizar los tres valores de arriba. Conviene asignarle una Elastic IP.

## Esquema

Una tabla, `users`. `genres` es `TEXT[]` con índice GIN (el emparejamiento por gustos se resuelve con `WHERE genres && $1::text[]`, sin joins) y `favorite_movies` es `JSONB` (nunca se filtra, sólo se lee completo).

El DDL vive en `db/init/001_init.sql` y se aplica por dos vías:

- **Dev:** docker-compose lo monta en `/docker-entrypoint-initdb.d`. Sólo corre con el volumen vacío — para reaplicar cambios, `docker compose down -v`.
- **Prod / RDS:** `npm run db:migrate`, que registra cada archivo en `schema_migrations` y aplica sólo los pendientes.
