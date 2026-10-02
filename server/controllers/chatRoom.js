import { getPool } from "../config/db.js";

function groupRooms(rows) {
  const rooms = new Map();

  rows.forEach((row) => {
    if (!rooms.has(row.id)) {
      rooms.set(row.id, {
        id: Number(row.id),
        createdAt: row.createdAt,
        members: [],
        lastMessage: "",
      });
    }
    rooms.get(row.id).members.push(Number(row.user_id));
  });

  return Array.from(rooms.values());
}

async function attachLastMessages(rooms, userId) {
  if (!rooms.length) return rooms;

  const [rows] = await getPool().query(
    `SELECT m.chat_room_id AS chatRoomId, m.message
     FROM messages m
     INNER JOIN (
       SELECT m2.chat_room_id, MAX(m2.id) AS lastId
       FROM messages m2
       WHERE m2.chat_room_id IN (?)
       AND NOT EXISTS (
         SELECT 1 FROM hidden_messages h
         WHERE h.message_id = m2.id AND h.user_id = ?
       )
       GROUP BY m2.chat_room_id
     ) latest ON latest.lastId = m.id`,
    [rooms.map((room) => room.id), userId]
  );

  const lastByRoom = new Map(rows.map((row) => [Number(row.chatRoomId), row.message]));

  return rooms.map((room) => ({
    ...room,
    lastMessage: lastByRoom.get(room.id) || "",
  }));
}

async function getRoomById(roomId) {
  const [rows] = await getPool().query(
    `SELECT r.id, r.created_at AS createdAt, m.user_id
     FROM chat_rooms r
     INNER JOIN chat_room_members m ON m.room_id = r.id
     WHERE r.id = ?`,
    [roomId]
  );

  return groupRooms(rows)[0] || null;
}

export const createChatRoom = async (req, res) => {
  const senderId = req.user.id;
  const receiverId = Number(req.body.receiverId);

  if (!receiverId || receiverId === senderId) {
    return res.status(400).json({ message: "Choose someone else to chat with" });
  }

  try {
    const [receiver] = await getPool().query("SELECT id FROM users WHERE id = ?", [
      receiverId,
    ]);

    if (!receiver.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const [existing] = await getPool().query(
      `SELECT r.id
       FROM chat_rooms r
       INNER JOIN chat_room_members a ON a.room_id = r.id AND a.user_id = ?
       INNER JOIN chat_room_members b ON b.room_id = r.id AND b.user_id = ?
       LIMIT 1`,
      [senderId, receiverId]
    );

    if (existing.length) {
      const room = await getRoomById(existing[0].id);
      return res.json(room);
    }

    const [result] = await getPool().query(
      "INSERT INTO chat_rooms (created_at) VALUES (CURRENT_TIMESTAMP)"
    );
    const roomId = result.insertId;

    await getPool().query(
      "INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?), (?, ?)",
      [roomId, senderId, roomId, receiverId]
    );

    const room = await getRoomById(roomId);
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: "Could not create chat" });
  }
};

export const getChatRoomOfUser = async (req, res) => {
  if (Number(req.params.userId) !== req.user.id) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const [rows] = await getPool().query(
      `SELECT r.id, r.created_at AS createdAt, m.user_id
       FROM chat_rooms r
       INNER JOIN chat_room_members m ON m.room_id = r.id
       WHERE r.id IN (
         SELECT room_id FROM chat_room_members WHERE user_id = ?
       )
       ORDER BY r.created_at DESC, r.id DESC`,
      [req.params.userId]
    );

    res.json(await attachLastMessages(groupRooms(rows), req.user.id));
  } catch (error) {
    res.status(500).json({ message: "Could not load chats" });
  }
};

export const getChatRoomOfUsers = async (req, res) => {
  const first = Number(req.params.firstUserId);
  const second = Number(req.params.secondUserId);

  if (first !== req.user.id && second !== req.user.id) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const [rows] = await getPool().query(
      `SELECT r.id, r.created_at AS createdAt, m.user_id
       FROM chat_rooms r
       INNER JOIN chat_room_members m ON m.room_id = r.id
       WHERE r.id IN (
         SELECT a.room_id
         FROM chat_room_members a
         INNER JOIN chat_room_members b ON b.room_id = a.room_id
         WHERE a.user_id = ? AND b.user_id = ?
       )`,
      [req.params.firstUserId, req.params.secondUserId]
    );

    res.json(groupRooms(rows));
  } catch (error) {
    res.status(500).json({ message: "Could not load chat" });
  }
};
