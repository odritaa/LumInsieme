'use strict';

const { pool } = require('../config/db');

const CAMPOS = `
  id, uuid, nombre, evento_id, creador_id, max_miembros,
  estado, ultimo_seq, creado_en, archivado_en
`;

function mapear(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    uuid: fila.uuid,
    nombre: fila.nombre,
    eventoId: fila.evento_id,
    creadorId: fila.creador_id,
    maxMiembros: fila.max_miembros,
    estado: fila.estado,
    ultimoSeq: fila.ultimo_seq,
    creadoEn: fila.creado_en,
    archivadoEn: fila.archivado_en
  };
}

async function crear(cliente, { nombre, eventoId, creadorId, maxMiembros }) {
  const { rows } = await cliente.query(
    `INSERT INTO chat_grupos (nombre, evento_id, creador_id, max_miembros)
     VALUES ($1, $2, $3, $4)
     RETURNING ${CAMPOS}`,
    [nombre, eventoId, creadorId, maxMiembros]
  );
  return mapear(rows[0]);
}

async function porId(id, cliente = pool) {
  const { rows } = await cliente.query(`SELECT ${CAMPOS} FROM chat_grupos WHERE id = $1`, [id]);
  return mapear(rows[0]);
}

/**
 * Toma el lock exclusivo de la fila del grupo.
 *
 * Este lock es el punto de serializacion de TODO el modulo: alta de miembros y
 * alta de mensajes lo piden primero y siempre en ese orden, lo que evita a la
 * vez el sobrecupo, los huecos en `seq` y los interbloqueos entre ambos flujos.
 */
async function bloquear(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT ${CAMPOS} FROM chat_grupos WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return mapear(rows[0]);
}

async function siguienteSeq(cliente, id) {
  const { rows } = await cliente.query(
    'UPDATE chat_grupos SET ultimo_seq = ultimo_seq + 1 WHERE id = $1 RETURNING ultimo_seq',
    [id]
  );
  return rows[0].ultimo_seq;
}

/**
 * Borra el grupo y, en cascada, sus miembros, mensajes e invitaciones.
 *
 * Solo se llama cuando no queda ningun miembro: sin nadie que pueda volver a
 * abrir la conversacion, conservarla es ocupar espacio sin beneficio. Es
 * distinto de que se cierren las sesiones, donde los mensajes SI se conservan.
 */
async function eliminar(cliente, id) {
  const { rowCount } = await cliente.query('DELETE FROM chat_grupos WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { crear, porId, bloquear, siguienteSeq, eliminar, mapear };
