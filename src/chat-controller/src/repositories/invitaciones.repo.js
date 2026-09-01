'use strict';

const { pool } = require('../config/db');

function mapear(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    chatId: fila.chat_id,
    invitadoId: fila.invitado_id,
    invitadorId: fila.invitador_id,
    estado: fila.estado,
    creadaEn: fila.creada_en,
    expiraEn: fila.expira_en,
    respondidaEn: fila.respondida_en
  };
}

async function crear(cliente, { chatId, invitadoId, invitadorId }) {
  const { rows } = await cliente.query(
    `INSERT INTO chat_invitaciones (chat_id, invitado_id, invitador_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [chatId, invitadoId, invitadorId]
  );
  return mapear(rows[0]);
}

/** Lectura sin lock, solo para descubrir a que grupo pertenece la invitacion. */
async function porId(id, cliente = pool) {
  const { rows } = await cliente.query('SELECT * FROM chat_invitaciones WHERE id = $1', [id]);
  return mapear(rows[0]);
}

/**
 * Lectura autoritativa. Debe ejecutarse DESPUES de bloquear el grupo: el orden
 * de locks del modulo es siempre chat_grupos primero.
 */
async function bloquear(cliente, id) {
  const { rows } = await cliente.query(
    'SELECT * FROM chat_invitaciones WHERE id = $1 FOR UPDATE',
    [id]
  );
  return mapear(rows[0]);
}

async function responder(cliente, id, estado) {
  const { rows } = await cliente.query(
    `UPDATE chat_invitaciones
        SET estado = $2, respondida_en = now()
      WHERE id = $1 AND estado = 'pendiente'
      RETURNING *`,
    [id, estado]
  );
  return mapear(rows[0]);
}

/** Invitaciones pendientes y vigentes que recibio el usuario. */
async function pendientesDe(invitadoId, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT i.*, g.nombre AS chat_nombre, g.max_miembros, g.estado AS chat_estado,
            (SELECT count(*)::int FROM chat_miembros m
              WHERE m.chat_id = g.id AND m.salio_en IS NULL) AS miembros_activos
       FROM chat_invitaciones i
       JOIN chat_grupos g ON g.id = i.chat_id
      WHERE i.invitado_id = $1
        AND i.estado = 'pendiente'
        AND i.expira_en > now()
      ORDER BY i.creada_en DESC`,
    [invitadoId]
  );

  return rows.map((fila) => ({
    ...mapear(fila),
    chat: {
      id: fila.chat_id,
      nombre: fila.chat_nombre,
      estado: fila.chat_estado,
      maxMiembros: fila.max_miembros,
      miembrosActivos: fila.miembros_activos,
      cupoDisponible: Math.max(fila.max_miembros - fila.miembros_activos, 0)
    }
  }));
}

/** Invitaciones pendientes emitidas para un grupo (visible para sus miembros). */
async function pendientesDeChat(chatId, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT * FROM chat_invitaciones
      WHERE chat_id = $1 AND estado = 'pendiente' AND expira_en > now()
      ORDER BY creada_en DESC`,
    [chatId]
  );
  return rows.map(mapear);
}

/**
 * Cierra la invitacion pendiente que tuviera el usuario en ese grupo.
 *
 * Se usa cuando alguien entra por su cuenta teniendo una invitacion abierta:
 * dejarla pendiente haria que le siguiera apareciendo un aviso para unirse a un
 * grupo en el que ya esta.
 */
async function cerrarPendienteDeUsuario(cliente, chatId, invitadoId, estado) {
  const { rows } = await cliente.query(
    `UPDATE chat_invitaciones
        SET estado = $3, respondida_en = now()
      WHERE chat_id = $1 AND invitado_id = $2 AND estado = 'pendiente'
      RETURNING *`,
    [chatId, invitadoId, estado]
  );
  return mapear(rows[0]);
}

module.exports = {
  crear,
  porId,
  bloquear,
  responder,
  pendientesDe,
  pendientesDeChat,
  cerrarPendienteDeUsuario,
  mapear
};
