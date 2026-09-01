'use strict';

const redis = require('../config/redis');
const log = require('../utils/log');

const CANAL = redis.clave('eventos');

const oyentes = new Set();
let suscrito = false;

/**
 * Bus de eventos entre replicas del chat-controller.
 *
 * Con mas de una instancia detras del balanceador, dos personas del mismo
 * grupo pueden estar conectadas a procesos distintos. Sin este bus, cada una
 * solo veria los mensajes de quienes cayeron en su misma instancia.
 *
 * Regla clave: quien publica NO entrega el evento a sus propios sockets. Todas
 * las instancias, incluida la emisora, entregan al recibir la publicacion. Asi
 * el camino es identico para todos y no hacen falta reglas de deduplicacion.
 */
async function iniciar() {
  if (suscrito) return;

  redis.suscriptor.on('message', (canal, carga) => {
    if (canal !== CANAL) return;

    let evento;
    try {
      evento = JSON.parse(carga);
    } catch (error) {
      log.warn('Evento del bus descartado por JSON invalido', { error: error.message });
      return;
    }

    for (const oyente of oyentes) {
      try {
        oyente(evento);
      } catch (error) {
        // Un oyente que falla no debe cortar la entrega a los demas.
        log.error('Oyente del bus fallo', { error: error.message, tipo: evento.tipo });
      }
    }
  });

  // ioredis vuelve a suscribirse solo tras una reconexion, asi que no hay que
  // rehacerlo a mano; basta con no perder el listener de 'message'.
  await redis.suscriptor.subscribe(CANAL);
  suscrito = true;
  log.info('Bus de eventos suscrito', { canal: CANAL });
}

/**
 * Publica un evento. Devuelve false si Redis no esta disponible: en ese caso
 * el llamador entrega solo a sus sockets locales (modo degradado) para que el
 * chat siga funcionando aunque se pierda el alcance entre instancias.
 */
async function publicar(evento) {
  if (!redis.estaDisponible()) return false;
  try {
    await redis.cliente.publish(CANAL, JSON.stringify(evento));
    return true;
  } catch (error) {
    log.warn('No se pudo publicar en el bus, se entrega solo local', { error: error.message });
    return false;
  }
}

function alRecibir(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

async function detener() {
  oyentes.clear();
  if (suscrito) {
    try {
      await redis.suscriptor.unsubscribe(CANAL);
    } catch (error) {
      log.warn('No se pudo cancelar la suscripcion del bus', { error: error.message });
    }
    suscrito = false;
  }
}

module.exports = { iniciar, publicar, alRecibir, detener, CANAL };
