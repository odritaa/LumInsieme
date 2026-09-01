'use strict';

const config = require('../config');
const { errores } = require('../utils/errores');

/**
 * Limitacion de tasa por usuario para las rutas REST de escritura.
 *
 * Sin esto, el limite del WebSocket es decorativo: quien quiera inundar el chat
 * solo tiene que usar `POST /api/chats/:id/mensajes`, que hace exactamente lo
 * mismo sin pasar por el token bucket de la conexion.
 *
 * El contador es local a la instancia: con N replicas el limite efectivo es N
 * veces mayor. Es un techo aproximado a proposito, para no depender de Redis en
 * el camino de escritura ni introducir un fallo nuevo cuando la cache se cae.
 */
const cubetas = new Map();

const LIMPIEZA_MS = 60000;

function crearLimitador({ capacidad, recargaPorSegundo }) {
  return function limitar(req, res, siguiente) {
    const clave = req.usuario?.usuarioId;
    if (clave === undefined) return siguiente(errores.noAutenticado());

    const ahora = Date.now();
    let cubeta = cubetas.get(clave);
    if (!cubeta) {
      cubeta = { tokens: capacidad, ultimo: ahora };
      cubetas.set(clave, cubeta);
    }

    cubeta.tokens = Math.min(capacidad, cubeta.tokens + ((ahora - cubeta.ultimo) / 1000) * recargaPorSegundo);
    cubeta.ultimo = ahora;

    if (cubeta.tokens < 1) {
      res.set('Retry-After', String(Math.ceil((1 - cubeta.tokens) / recargaPorSegundo)));
      return siguiente(errores.demasiadasSolicitudes('Estas enviando demasiado rapido'));
    }

    cubeta.tokens -= 1;
    return siguiente();
  };
}

// Sin esta purga el Map crece con un registro por usuario que haya escrito
// alguna vez, y no se libera nunca.
const purga = setInterval(() => {
  const limite = Date.now() - LIMPIEZA_MS;
  for (const [clave, cubeta] of cubetas) {
    if (cubeta.ultimo < limite) cubetas.delete(clave);
  }
}, LIMPIEZA_MS);
purga.unref();

const limitarMensajes = crearLimitador(config.websocket.rateLimit);

// Crear grupos es mucho mas caro que enviar un mensaje y no hay motivo
// legitimo para hacerlo en rafaga.
const limitarCreacion = crearLimitador({ capacidad: 5, recargaPorSegundo: 0.1 });

module.exports = { crearLimitador, limitarMensajes, limitarCreacion };
