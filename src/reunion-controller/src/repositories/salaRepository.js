import { query, withTransaction } from "../database.js";
import Sala from "../models/Sala.js";
import httpError from "../utils/httpError.js";

const FEED_LIMIT = 100;

const SELECT_SALAS = `
  SELECT s.id, s.host_id, h.name AS host_name, s.movie, s.place, s.date,
         to_char(s.time, 'HH24:MI') AS time, s.capacity, s.note, s.created_at,
         COALESCE(
           json_agg(json_build_object('id', u.id, 'name', u.name, 'genres', u.genres) ORDER BY m.joined_at)
             FILTER (WHERE u.id IS NOT NULL),
           '[]'
         ) AS members
    FROM salas s
    JOIN users h ON h.id = s.host_id
    LEFT JOIN sala_miembros m ON m.sala_id = s.id
    LEFT JOIN users u ON u.id = m.user_id`;

// Feed identico para todos: solo por fecha de publicacion, de la mas reciente a la mas lejana.
export async function listUpcoming(today) {
  const { rows } = await query(
    `${SELECT_SALAS}
      WHERE s.date >= $1
      GROUP BY s.id, h.name
      ORDER BY s.created_at DESC
      LIMIT ${FEED_LIMIT}`,
    [today]
  );
  return rows.map(Sala.fromRow);
}

export async function findById(id, db = { query }) {
  const { rows } = await db.query(`${SELECT_SALAS} WHERE s.id = $1 GROUP BY s.id, h.name`, [id]);
  return rows[0] ? Sala.fromRow(rows[0]) : null;
}

export async function create(hostId, { movie, place, date, time, capacity, note }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO salas (host_id, movie, place, date, time, capacity, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [hostId, movie, place, date, time, capacity, note]
    );
    const { id } = rows[0];
    await client.query("INSERT INTO sala_miembros (sala_id, user_id) VALUES ($1, $2)", [id, hostId]);
    return findById(id, client);
  });
}

// FOR UPDATE serializa las altas concurrentes: sin el lock dos usuarios pueden ocupar el ultimo lugar.
export async function join(salaId, userId, today) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT capacity, date::text AS date FROM salas WHERE id = $1 FOR UPDATE",
      [salaId]
    );
    if (!rows[0]) throw httpError(404, "sala_not_found");

    const membership = await client.query(
      "SELECT 1 FROM sala_miembros WHERE sala_id = $1 AND user_id = $2",
      [salaId, userId]
    );
    if (membership.rowCount === 0) {
      if (rows[0].date < today) throw httpError(409, "sala_closed");
      const count = await client.query("SELECT count(*)::int AS n FROM sala_miembros WHERE sala_id = $1", [salaId]);
      if (count.rows[0].n >= rows[0].capacity) throw httpError(409, "sala_full");
      await client.query("INSERT INTO sala_miembros (sala_id, user_id) VALUES ($1, $2)", [salaId, userId]);
    }

    return findById(salaId, client);
  });
}

// Si se va el anfitrion, la sala pasa al miembro mas antiguo; si no queda nadie, se elimina.
export async function leave(salaId, userId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query("SELECT host_id FROM salas WHERE id = $1 FOR UPDATE", [salaId]);
    if (!rows[0]) throw httpError(404, "sala_not_found");

    await client.query("DELETE FROM sala_miembros WHERE sala_id = $1 AND user_id = $2", [salaId, userId]);

    if (rows[0].host_id === userId) {
      const next = await client.query(
        "SELECT user_id FROM sala_miembros WHERE sala_id = $1 ORDER BY joined_at LIMIT 1",
        [salaId]
      );
      if (next.rowCount === 0) {
        await client.query("DELETE FROM salas WHERE id = $1", [salaId]);
        return null;
      }
      await client.query("UPDATE salas SET host_id = $2 WHERE id = $1", [salaId, next.rows[0].user_id]);
    }

    return findById(salaId, client);
  });
}
