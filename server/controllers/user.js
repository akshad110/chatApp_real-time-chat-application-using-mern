import { getPool } from "../config/db.js";
import { findUserById, toPublicUser } from "../utils/users.js";

export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await getPool().query(
      "SELECT id, email, display_name, photo_url FROM users ORDER BY display_name, email"
    );
    res.json(rows.map(toPublicUser));
  } catch (error) {
    res.status(500).json({ message: "Could not load users" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Could not load user" });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Could not load user" });
  }
};

export const updateProfile = async (req, res) => {
  const displayName = String(req.body.displayName || "").trim();
  const photoURL = String(req.body.photoURL || "");

  if (!displayName) {
    return res.status(400).json({ message: "Display name is required" });
  }

  try {
    await getPool().query(
      "UPDATE users SET display_name = ?, photo_url = ? WHERE id = ?",
      [displayName, photoURL, req.user.id]
    );

    const user = await findUserById(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Could not update profile" });
  }
};
