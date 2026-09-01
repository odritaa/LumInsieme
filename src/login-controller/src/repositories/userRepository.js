import { query } from "../database.js";
import User from "../models/User.js";

const COLUMNS = {
  name: "name",
  age: "age",
  city: "city",
  genres: "genres",
  favoriteMovies: "favorite_movies",
};

// name solo se escribe en el INSERT: si el usuario lo edito en LumInsieme,
// el proximo login no debe pisarlo con el de Google.
export async function upsertFromGoogle({ googleSub, email, name, picture }) {
  const { rows } = await query(
    `INSERT INTO users (google_sub, email, name, picture, last_login_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (google_sub) DO UPDATE
        SET email         = EXCLUDED.email,
            picture       = EXCLUDED.picture,
            last_login_at = now(),
            updated_at    = now()
     RETURNING *`,
    [googleSub, email, name, picture]
  );
  return User.fromRow(rows[0]);
}

export async function findById(id) {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ? User.fromRow(rows[0]) : null;
}

export async function updateProfile(id, patch) {
  const assignments = [];
  const values = [id];

  for (const [field, column] of Object.entries(COLUMNS)) {
    if (!(field in patch)) continue;
    const value = field === "favoriteMovies" ? JSON.stringify(patch[field]) : patch[field];
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }

  if (assignments.length === 0) return findById(id);

  const { rows } = await query(
    `UPDATE users SET ${assignments.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    values
  );
  return rows[0] ? User.fromRow(rows[0]) : null;
}

export async function remove(id) {
  const { rowCount } = await query("DELETE FROM users WHERE id = $1", [id]);
  return rowCount > 0;
}
