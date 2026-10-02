import { getPool } from "../config/db.js";

export function toPublicUser(row) {
  return {
    uid: Number(row.id),
    email: row.email,
    displayName: row.display_name || "",
    photoURL: row.photo_url || "",
  };
}

export async function findUserById(id) {
  const [rows] = await getPool().query(
    "SELECT id, email, display_name, photo_url FROM users WHERE id = ?",
    [id]
  );

  return rows[0] ? toPublicUser(rows[0]) : null;
}
