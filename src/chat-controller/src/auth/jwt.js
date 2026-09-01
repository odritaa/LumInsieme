'use strict';

const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const config = require('../config');
const { errores } = require('../utils/errores');

/**
 * Verifica el JWT emitido por login-controller y devuelve la identidad.
 * Se acepta `sub`, `id` o `usuarioId` como identificador para no acoplarse a
 * una forma exacta del payload mientras login-controller se termina.
 */
function verificarToken(token) {
  if (!token) {
    throw errores.noAutenticado('No se envio token de sesion');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secreto, {
      algorithms: ['HS256'],
      issuer: config.jwt.emisor || undefined,
      audience: config.jwt.audiencia || undefined
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw errores.noAutenticado('La sesion expiro');
    }
    throw errores.noAutenticado('Token de sesion invalido');
  }

  const bruto = payload.sub ?? payload.id ?? payload.usuarioId ?? payload.userId;
  const usuarioId = Number.parseInt(String(bruto ?? ''), 10);
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
    throw errores.noAutenticado('El token no contiene un identificador de usuario valido');
  }

  return {
    usuarioId,
    nombre: payload.nombre ?? payload.name ?? null,
    // `exp` viene en segundos. Se usa para cerrar el WebSocket cuando caduca.
    expiraEnMs: typeof payload.exp === 'number' ? payload.exp * 1000 : null
  };
}

/**
 * Extrae el token de la cookie de sesion o del header Authorization.
 * El navegador no permite headers personalizados en el handshake WebSocket,
 * por eso la cookie es el camino principal.
 */
function extraerToken(req) {
  const autorizacion = req.headers?.authorization;
  if (typeof autorizacion === 'string' && autorizacion.startsWith('Bearer ')) {
    return autorizacion.slice(7).trim();
  }

  if (req.cookies && req.cookies[config.jwt.nombreCookie]) {
    return req.cookies[config.jwt.nombreCookie];
  }

  const cabecera = req.headers?.cookie;
  if (typeof cabecera === 'string') {
    const cookies = cookie.parse(cabecera);
    if (cookies[config.jwt.nombreCookie]) return cookies[config.jwt.nombreCookie];
  }

  return null;
}

function autenticarPeticion(req) {
  const token = extraerToken(req);
  // Se conserva el token verificado para poder reenviarlo a otros
  // microservicios (ver clients/reunion.client.js) sin volver a extraerlo.
  return { ...verificarToken(token), token };
}

module.exports = { verificarToken, extraerToken, autenticarPeticion };
