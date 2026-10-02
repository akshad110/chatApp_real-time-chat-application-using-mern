import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { getPool } from "../config/db.js";
import { toPublicUser } from "../utils/users.js";

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export const register = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const [existing] = await getPool().query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await getPool().query(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, hash]
    );

    const user = {
      uid: result.insertId,
      email,
      displayName: "",
      photoURL: "",
    };

    res.status(201).json({ token: signToken(user.uid), user });
  } catch (error) {
    res.status(500).json({ message: "Could not register" });
  }
};

export const login = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const [rows] = await getPool().query(
      "SELECT id, email, password, display_name, photo_url FROM users WHERE email = ?",
      [email]
    );

    const row = rows[0];
    if (!row) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const matches = await bcrypt.compare(password, row.password);
    if (!matches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = toPublicUser(row);
    res.json({ token: signToken(user.uid), user });
  } catch (error) {
    res.status(500).json({ message: "Could not login" });
  }
};
