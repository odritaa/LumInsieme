'use strict';

const { pool } = require('../config/db');

function mapear(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    chatId: fila.chat_id,
    seq: fila.seq,
    autorId: fila.autor_id,
    tipo: fila.tipo,
    contenido: fila.eliminado_en ? null : fila.contenido,
    clientMsgId: fila.client_msg_id,
    creadoEn: fila.creado_en,
    eliminado: fila.eliminado_en !== null
  };
}

async function porClientMsgId(cliente, { chatId, autorId, clientMsgId }) {
  const { rows } = await cliente.query(
    `SELECT * FROM chat_mensajes
      WHERE chat_id = $1 AND autor_id = $2 AND client_msg_id = $3`,
    [chatId, autorId, clientMsgId]
  );
  return mapear(rows[0]);
}

async function insertar(cliente, { chatId, seq, autorId, tipo, contenido, clientMsgId }) {
  const { rows } = await cliente.query(
    `INSERT INTO chat_mensajes (chat_id, seq, autor_id, tipo, contenido, client_msg_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [chatId, seq, autorId, tipo, contenido, clientMsgId]
  );
  return mapear(rows[0]);
}

/**
 * Historial hacia atras con paginacion por keyset.
 *
 * No se usa OFFSET: con mensajes llegando mientras el usuario scrollea, el
 * desplazamiento corre y se repiten o se saltan filas. El cursor `antesDe`
 * apunta a un `seq` concreto y es estable ante inserciones concurrentes.
 */
async function historial(chatId, { antesDe, limite }) {
  const parametros = [chatId, limite];
  let filtro = '';
  if (antesDe !== null && antesDe !== undefined) {
    parametros.push(antesDe);
    filtro = `AND seq < $${parametros.length}`;
  }

  const { rows } = await pool.query(
    `SELECT * FROM chat_mensajes
      WHERE chat_id = $1 ${filtro}
      ORDER BY seq DESC
      LIMIT $2`,
    parametros
  );

  // Se devuelve en orden cronologico ascendente, listo para pintar.
  return rows.reverse().map(mapear);
}

/**
 * Mensajes posteriores a `desdeSeq`. Es la reconexion: el cliente guarda el
 * ultimo `seq` que recibio y al volver pide solo lo que se perdio.
 */
async function desdeSeq(chatId, desdeSeq, limite) {
  const { rows } = await pool.query(
    `SELECT * FROM chat_mensajes
      WHERE chat_id = $1 AND seq > $2
      ORDER BY seq ASC
      LIMIT $3`,
    [chatId, desdeSeq, limite]
  );
  return rows.map(mapear);
}

module.exports = { porClientMsgId, insertar, historial, desdeSeq, mapear };
