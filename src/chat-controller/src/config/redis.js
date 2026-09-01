'use strict';

const Redis = require('ioredis');
const config = require('./index');
const log = require('../utils/log');

const opciones = {
  // Sin cola offline las operaciones fallan rapido cuando Redis esta caido, en
  // lugar de acumularse y bloquear peticiones. El chat degrada a PostgreSQL.
  enableOfflineQueue: false,
  maxRetriesPerRequest: 2,
  connectTimeout: 3000,
  retryStrategy: (intentos) => Math.min(intentos * 200, 5000)
};

// Una conexion en modo suscriptor no puede ejecutar comandos normales:
// se necesitan dos clientes separados.
const cliente = new Redis(config.redis.url, opciones);
const suscriptor = new Redis(config.redis.url, opciones);

let disponible = false;

function registrarEventos(instancia, etiqueta) {
  instancia.on('ready', () => {
    if (etiqueta === 'comandos') disponible = true;
    log.info('Redis conectado', { cliente: etiqueta });
  });
  instancia.on('end', () => {
    if (etiqueta === 'comandos') disponible = false;
    log.warn('Redis desconectado', { cliente: etiqueta });
  });
  // Sin listener de 'error', ioredis emite un error no capturado y mata el proceso.
  instancia.on('error', (error) => {
    if (etiqueta === 'comandos') disponible = false;
    log.warn('Error de Redis', { cliente: etiqueta, error: error.message });
  });
}

registrarEventos(cliente, 'comandos');
registrarEventos(suscriptor, 'suscriptor');

function clave(...partes) {
  return [config.redis.prefijo, ...partes].join(':');
}

/**
 * Redis es un acelerador, nunca la fuente de verdad. Cualquier fallo se
 * degrada a `porDefecto` y el llamador sigue con PostgreSQL.
 */
async function intentar(operacion, porDefecto = null) {
  if (!disponible) return porDefecto;
  try {
    return await operacion(cliente);
  } catch (error) {
    log.warn('Operacion de cache fallida, se degrada a PostgreSQL', { error: error.message });
    return porDefecto;
  }
}

function estaDisponible() {
  return disponible;
}

async function cerrar() {
  await Promise.allSettled([cliente.quit(), suscriptor.quit()]);
}

module.exports = { cliente, suscriptor, clave, intentar, estaDisponible, cerrar };
