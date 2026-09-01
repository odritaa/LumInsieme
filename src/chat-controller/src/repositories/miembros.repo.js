'use strict';

const { pool } = require('../config/db');

function mapear(fila) {
  if (!fila) return null;
  return {
    chatId: fila.chat_id,
    usuarioId: fila.usuario_id,
    rol: fila.rol,
    unidoEn: fila.unido_en,
    salioEn: fila.salio_en,
    ultimoLeidoSeq: fila.ultimo_leido_seq,
    activo: fila.salio_en === null
  };
}

async function obtener(chatId, usuarioId, cliente = pool) {
  const { rows } = await cliente.query(
    'SELECT * FROM chat_miembros WHERE chat_id = $1 AND usuario_id = $2',
    [chatId, usuarioId]
  );
  return mapear(rows[0]);
}

async function contarActivos(chatId, cliente = pool) {
  const { rows } = await cliente.query(
    'SELECT count(*)::int AS total FROM chat_miembros WHERE chat_id = $1 AND salio_en IS NULL',
    [chatId]
  );
  return rows[0].total;
}

async function listarActivos(chatId, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT * FROM chat_miembros
      WHERE chat_id = $1 AND salio_en IS NULL
      ORDER BY unido_en ASC`,
    [chatId]
  );
  return rows.map(mapear);
}

/**
 * Alta de miembro. Si la fila ya existe (el usuario se fue y vuelve) se
 * reactiva. Debe ejecutarse con el grupo ya bloqueado por `grupos.bloquear`.
 */
async function altaOReingreso(cliente, { chatId, usuarioId, rol = 'miembro', leidoInicial = 0 }) {
  const { rows } = await cliente.query(
    `INSERT INTO chat_miembros (chat_id, usuario_id, rol, ultimo_leido_seq)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (chat_id, usuario_id) DO UPDATE
        SET salio_en = NULL,
            unido_en = now(),
            ultimo_leido_seq = GREATEST(chat_miembros.ultimo_leido_seq, EXCLUDED.ultimo_leido_seq)
     RETURNING *`,
    [chatId, usuarioId, rol, leidoInicial]
  );
  return mapear(rows[0]);
}

async function marcarSalida(cliente, chatId, usuarioId) {
  const { rows } = await cliente.query(
    `UPDATE chat_miembros
        SET salio_en = now()
      WHERE chat_id = $1 AND usuario_id = $2 AND salio_en IS NULL
      RETURNING *`,
    [chatId, usuarioId]
  );
  return mapear(rows[0]);
}

/**
 * Avanza el cursor de lectura. GREATEST evita que un ACK que llega tarde
 * (fuera de orden por la red) retroceda el contador de no leidos.
 */
async function actualizarLeido(chatId, usuarioId, seq, cliente = pool) {
  const { rows } = await cliente.query(
    `UPDATE chat_miembros
        SET ultimo_leido_seq = GREATEST(ultimo_leido_seq, $3)
      WHERE chat_id = $1 AND usuario_id = $2 AND salio_en IS NULL
      RETURNING *`,
    [chatId, usuarioId, seq]
  );
  return mapear(rows[0]);
}

/**
 * Chats del usuario con su conteo de no leidos.
 *
 * El conteo es aritmetico (ultimo_seq - ultimo_leido_seq) y no un COUNT porque
 * `seq` es contigua por chat: sale en tiempo constante y no toca la tabla de
 * mensajes.
 */
async function chatsDeUsuario(usuarioId, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT g.id, g.uuid, g.nombre, g.evento_id, g.creador_id, g.max_miembros,
            g.estado, g.ultimo_seq, g.creado_en,
            m.rol, m.ultimo_leido_seq,
            GREATEST(g.ultimo_seq - m.ultimo_leido_seq, 0)::int AS no_leidos,
            (SELECT count(*)::int FROM chat_miembros mm
              WHERE mm.chat_id = g.id AND mm.salio_en IS NULL) AS miembros_activos
       FROM chat_miembros m
       JOIN chat_grupos g ON g.id = m.chat_id
      WHERE m.usuario_id = $1 AND m.salio_en IS NULL
      ORDER BY g.ultimo_seq DESC, g.creado_en DESC`,
    [usuarioId]
  );

  return rows.map((fila) => ({
    id: fila.id,
    uuid: fila.uuid,
    nombre: fila.nombre,
    eventoId: fila.evento_id,
    creadorId: fila.creador_id,
    maxMiembros: fila.max_miembros,
    miembrosActivos: fila.miembros_activos,
    estado: fila.estado,
    ultimoSeq: fila.ultimo_seq,
    creadoEn: fila.creado_en,
    rol: fila.rol,
    ultimoLeidoSeq: fila.ultimo_leido_seq,
    noLeidos: fila.no_leidos
  }));
}

async function hayAdminActivo(chatId, cliente) {
  const { rows } = await cliente.query(
    `SELECT 1 FROM chat_miembros
      WHERE chat_id = $1 AND salio_en IS NULL AND rol = 'admin'
      LIMIT 1`,
    [chatId]
  );
  return rows.length > 0;
}

/**
 * Asciende a administrador a un miembro activo elegido al azar.
 *
 * Se ejecuta con el grupo ya bloqueado, asi que no hay carrera posible entre
 * dos salidas simultaneas que asciendan a dos personas distintas.
 */
async function promoverAleatorio(cliente, chatId) {
  const { rows } = await cliente.query(
    `UPDATE chat_miembros
        SET rol = 'admin'
      WHERE chat_id = $1
        AND usuario_id = (
          SELECT usuario_id FROM chat_miembros
           WHERE chat_id = $1 AND salio_en IS NULL AND rol <> 'admin'
           ORDER BY random()
           LIMIT 1
        )
      RETURNING *`,
    [chatId]
  );
  return mapear(rows[0]);
}

module.exports = {
  obtener,
  contarActivos,
  listarActivos,
  altaOReingreso,
  marcarSalida,
  actualizarLeido,
  chatsDeUsuario,
  hayAdminActivo,
  promoverAleatorio,
  mapear
};
