'use strict';

require('dotenv').config();

const crypto = require('crypto');

function requerido(nombre) {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') {
    throw new Error(`Falta la variable de entorno obligatoria: ${nombre}`);
  }
  return valor.trim();
}

function entero(nombre, porDefecto) {
  const bruto = process.env[nombre];
  if (bruto === undefined || bruto.trim() === '') return porDefecto;
  const valor = Number.parseInt(bruto, 10);
  if (!Number.isFinite(valor)) {
    throw new Error(`La variable ${nombre} debe ser un numero entero`);
  }
  return valor;
}

function lista(nombre, porDefecto) {
  const bruto = process.env[nombre];
  if (!bruto || bruto.trim() === '') return porDefecto;
  return bruto
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const entorno = process.env.NODE_ENV || 'development';
const origenesPermitidos = lista('CORS_ORIGINS', ['http://localhost:5173']);

const config = {
  entorno,
  esProduccion: entorno === 'production',
  puerto: entero('PORT', 4002),

  // Identifica esta replica dentro del cluster. Se usa para diagnosticar
  // que instancia atendio cada conexion en los logs y en /health.
  instanciaId: process.env.INSTANCE_ID || `chat-${crypto.randomBytes(4).toString('hex')}`,

  postgres: {
    connectionString: requerido('DATABASE_URL'),
    max: entero('PG_POOL_MAX', 10),
    idleTimeoutMillis: entero('PG_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMillis: entero('PG_CONNECT_TIMEOUT_MS', 5000),
    statementTimeoutMillis: entero('PG_STATEMENT_TIMEOUT_MS', 5000)
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    prefijo: process.env.REDIS_PREFIX || 'luminsieme:chat',
    ttlRecientesSeg: entero('REDIS_TTL_RECIENTES_SEG', 86400),
    maxRecientes: entero('REDIS_MAX_RECIENTES', 50),
    ttlPresenciaSeg: entero('REDIS_TTL_PRESENCIA_SEG', 90)
  },

  jwt: {
    // Debe ser el MISMO secreto que firma los tokens en login-controller.
    secreto: requerido('JWT_SECRET'),
    emisor: process.env.JWT_ISSUER || null,
    audiencia: process.env.JWT_AUDIENCE || null,
    nombreCookie: process.env.COOKIE_NAME || 'lum_session'
  },

  cors: {
    origenes: origenesPermitidos
  },

  reunion: {
    // Sin configurar, no se valida la existencia de los eventos. Ver
    // clients/reunion.client.js.
    url: (process.env.REUNION_SERVICE_URL || '').trim().replace(/\/+$/, '') || null,
    timeoutMs: entero('REUNION_TIMEOUT_MS', 2000)
  },

  chat: {
    maxMiembrosPermitido: entero('CHAT_MAX_MIEMBROS', 50),
    maxLongitudMensaje: entero('CHAT_MAX_LONGITUD_MENSAJE', 2000),
    paginaHistorial: entero('CHAT_PAGINA_HISTORIAL', 50),
    paginaHistorialMax: entero('CHAT_PAGINA_HISTORIAL_MAX', 100)
  },

  websocket: {
    ruta: process.env.WS_PATH || '/ws',
    // Origenes aceptados en el handshake. Sin esta validacion, cualquier sitio
    // podria abrir un WebSocket contra este servicio con la cookie de sesion
    // del usuario (Cross-Site WebSocket Hijacking): el navegador NO aplica
    // la politica del mismo origen a las conexiones WebSocket.
    origenes: lista('WS_ORIGINS', origenesPermitidos),
    maxPayloadBytes: entero('WS_MAX_PAYLOAD_BYTES', 16 * 1024),
    intervaloHeartbeatMs: entero('WS_HEARTBEAT_MS', 30000),
    maxBufferBytes: entero('WS_MAX_BUFFER_BYTES', 1024 * 1024),
    maxConexionesPorUsuario: entero('WS_MAX_CONEXIONES_POR_USUARIO', 5),
    maxSuscripcionesPorConexion: entero('WS_MAX_SUSCRIPCIONES', 20),
    rateLimit: {
      capacidad: entero('WS_RATE_CAPACIDAD', 10),
      recargaPorSegundo: Number(process.env.WS_RATE_RECARGA || 2)
    }
  },

  mantenimiento: {
    habilitado: process.env.MANTENIMIENTO_HABILITADO !== 'false',
    intervaloPurgaMs: entero('MANTENIMIENTO_INTERVALO_MS', 3600000),
    retencionInvitacionesDias: entero('RETENCION_INVITACIONES_DIAS', 30)
  },

  apagado: {
    timeoutMs: entero('SHUTDOWN_TIMEOUT_MS', 10000)
  }
};

module.exports = config;
