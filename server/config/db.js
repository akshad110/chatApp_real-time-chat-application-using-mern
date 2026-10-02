import mysql from "mysql2/promise";

let pool;

export function getPool() {
  return pool;
}

export async function connectDB() {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "letschat";

  if (!user) {
    throw new Error("DB_USER is missing. Add it to the .env file.");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing. Add it to the .env file.");
  }

  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error("DB_NAME can only contain letters, numbers, and underscores.");
  }

  const baseConfig = {
    host,
    port,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  };

  if (process.env.DB_SSL === "true") {
    baseConfig.ssl = { rejectUnauthorized: true };
  }

  pool = mysql.createPool({ ...baseConfig, database });

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      throw new Error("MySQL rejected DB_USER or DB_PASSWORD from the .env file.");
    }

    if (error.code !== "ER_BAD_DB_ERROR") {
      throw error;
    }

    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      ssl: baseConfig.ssl,
    });
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.end();

    await pool.end();
    pool = mysql.createPool({ ...baseConfig, database });
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL DEFAULT '',
      photo_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_room_members (
      room_id INT NOT NULL,
      user_id INT NOT NULL,
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chat_room_id INT NOT NULL,
      sender_id INT NOT NULL,
      message TEXT NOT NULL,
      delivered TINYINT NOT NULL DEFAULT 0,
      seen TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await addColumnIfMissing("messages", "delivered", "TINYINT NOT NULL DEFAULT 0");
  await addColumnIfMissing("messages", "seen", "TINYINT NOT NULL DEFAULT 0");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hidden_messages (
      message_id INT NOT NULL,
      user_id INT NOT NULL,
      PRIMARY KEY (message_id, user_id),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log("MySQL connected");
}

async function addColumnIfMissing(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );

  if (!Number(rows[0].total)) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}
