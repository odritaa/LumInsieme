'use strict';

const config = require('../config');
const log = require('../utils/log');
const { errores } = require('../utils/errores');

/**
 * Cliente del reunion-controller, usado para comprobar que un evento existe
 * antes de crearle un chat.
 *
 * Compromiso deliberado sobre la disponibilidad: si el reunion-controller esta
 * configurado pero no responde, la creacion de chats CON evento falla (503) en
 * lugar de dejar pasar referencias invalidas. Es un acoplamiento acotado a un
 * solo endpoint poco frecuente; el resto del chat (enviar, leer, unirse) no
 * depende de este servicio y sigue funcionando igual.
 *
 * Si `REUNION_SERVICE_URL` no esta configurada, la validacion se omite. Eso
 * permite desarrollar el chat antes de que el reunion-controller exista, y
 * queda registrado en el log para que no pase inadvertido en produccion.
 */

const RUTA_EVENTO = (eventoId) => `${config.reunion.url}/api/eventos/${eventoId}`;

let avisoOmisionEmitido = false;

async function eventoExiste(eventoId, token) {
  if (!config.reunion.url) {
    if (!avisoOmisionEmitido) {
      log.warn('REUNION_SERVICE_URL no configurada: no se valida la existencia de los eventos');
      avisoOmisionEmitido = true;
    }
    return { validado: false, existe: true };
  }

  // Sin timeout explicito, fetch espera indefinidamente y una peticion de
  // creacion podria quedar colgada hasta agotar el pool de conexiones.
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), config.reunion.timeoutMs);

  try {
    const respuesta = await fetch(RUTA_EVENTO(eventoId), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        // Se reenvia la sesion de quien pidio crear el chat: el
        // reunion-controller decide si esa persona puede ver ese evento.
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      signal: control.signal
    });

    if (respuesta.status === 404) return { validado: true, existe: false };
    if (respuesta.ok) return { validado: true, existe: true };

    if (respuesta.status === 401 || respuesta.status === 403) {
      throw errores.prohibido('No tenes acceso a ese evento');
    }

    log.warn('Respuesta inesperada del reunion-controller', {
      eventoId,
      estado: respuesta.status
    });
    throw errores.interno('No se pudo validar el evento');
  } catch (error) {
    if (error.esOperacional) throw error;

    const esTimeout = error.name === 'AbortError';
    log.warn('El reunion-controller no respondio', {
      eventoId,
      error: esTimeout ? `timeout de ${config.reunion.timeoutMs}ms` : error.message
    });

    const fallo = errores.interno(
      'El servicio de eventos no esta disponible, intentá crear el chat en unos minutos'
    );
    fallo.estado = 503;
    fallo.codigo = 'SERVICIO_EVENTOS_NO_DISPONIBLE';
    throw fallo;
  } finally {
    clearTimeout(temporizador);
  }
}

/** Lanza si el evento no existe. Devuelve si se llego a validar de verdad. */
async function exigirEventoExistente(eventoId, token) {
  const { validado, existe } = await eventoExiste(eventoId, token);
  if (validado && !existe) {
    throw errores.invalido(`El evento ${eventoId} no existe`);
  }
  return validado;
}

module.exports = { eventoExiste, exigirEventoExistente };
