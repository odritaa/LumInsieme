'use strict';

const { pool, consultar } = require('../config/db');
const config = require('../config');
const log = require('../utils/log');

// Identificador estable del lock consultivo de la purga.
const LOCK_ID = 728195;

let temporizador = null;

/**
 * Borra invitaciones que ya no sirven para nada.
 *
 * Dos grupos distintos:
 *  - Pendientes vencidas: ya se filtran al leer, pero la fila queda ocupando
 *    espacio y bloqueando el indice unico parcial de "una pendiente por
 *    persona y grupo", asi que nadie podria volver a invitar a esa persona.
 *  - Resueltas antiguas: aceptadas, rechazadas o canceladas hace mas del
 *    periodo de retencion. Su valor historico no compensa el crecimiento.
 *
 * El lock consultivo hace que solo una instancia purgue por vez. Sin el, las N
 * replicas correrian el mismo DELETE a la vez, compitiendo por las mismas filas.
 * `pg_try_advisory_lock` no espera: si otra instancia esta purgando, esta se
 * saltea el turno, que es exactamente lo que se quiere en una tarea periodica.
 */
async function purgarInvitaciones() {
  const cliente = await pool.connect();
  try {
    const { rows } = await cliente.query('SELECT pg_try_advisory_lock($1) AS tomado', [LOCK_ID]);
    if (!rows[0].tomado) {
      log.debug('Purga salteada: otra instancia la esta ejecutando');
      return null;
    }

    try {
      const vencidas = await cliente.query(
        `DELETE FROM chat_invitaciones
          WHERE estado = 'pendiente' AND expira_en <= now()`
      );

      const resueltas = await cliente.query(
        `DELETE FROM chat_invitaciones
          WHERE estado <> 'pendiente'
            AND respondida_en < now() - ($1 || ' days')::interval`,
        [String(config.mantenimiento.retencionInvitacionesDias)]
      );

      const resultado = {
        vencidas: vencidas.rowCount,
        resueltas: resueltas.rowCount
      };

      if (resultado.vencidas > 0 || resultado.resueltas > 0) {
        log.info('Purga de invitaciones completada', resultado);
      }

      return resultado;
    } finally {
      await cliente.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    }
  } finally {
    cliente.release();
  }
}

function iniciar() {
  if (!config.mantenimiento.habilitado) {
    log.info('Tareas de mantenimiento deshabilitadas');
    return;
  }

  const intervalo = config.mantenimiento.intervaloPurgaMs;

  // Una purga al arrancar, con retraso: si varias instancias se levantan a la
  // vez tras un despliegue, no arrancan todas contra la base en el mismo
  // instante. El lock igual las protege, pero asi ni siquiera compiten.
  const arranque = setTimeout(() => {
    purgarInvitaciones().catch((error) =>
      log.error('Fallo la purga inicial', { error: error.message }));
  }, 5000 + Math.floor(Math.random() * 10000));
  arranque.unref();

  temporizador = setInterval(() => {
    purgarInvitaciones().catch((error) =>
      log.error('Fallo la purga periodica', { error: error.message }));
  }, intervalo);
  temporizador.unref();

  log.info('Mantenimiento programado', { intervaloMin: Math.round(intervalo / 60000) });
}

function detener() {
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
}

module.exports = { purgarInvitaciones, iniciar, detener };
