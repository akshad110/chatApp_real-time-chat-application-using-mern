import { getPool } from "../config/db.js";
import { isOnline } from "../onlineUsers.js";

async function isMember(roomId, userId) {
  const [rows] = await getPool().query(
    "SELECT 1 FROM chat_room_members WHERE room_id = ? AND user_id = ?",
    [roomId, userId]
  );
  return rows.length > 0;
}

function toMessage(row) {
  return {
    id: Number(row.id),
    chatRoomId: Number(row.chatRoomId),
    sender: Number(row.sender),
    message: row.message,
    createdAt: row.createdAt,
    delivered: Boolean(row.delivered),
    seen: Boolean(row.seen),
  };
}

async function otherMemberId(roomId, userId) {
  const [rows] = await getPool().query(
    "SELECT user_id FROM chat_room_members WHERE room_id = ? AND user_id <> ?",
    [roomId, userId]
  );
  return rows[0] ? Number(rows[0].user_id) : null;
}

async function latestVisibleMessage(roomId, userId) {
  const [rows] = await getPool().query(
    `SELECT message
     FROM messages m
     WHERE chat_room_id = ?
     AND NOT EXISTS (
       SELECT 1 FROM hidden_messages h
       WHERE h.message_id = m.id AND h.user_id = ?
     )
     ORDER BY m.id DESC
     LIMIT 1`,
    [roomId, userId]
  );
  return rows[0]?.message || "";
}

async function hideMessages(messageIds, userId) {
  if (!messageIds.length) return;
  const values = messageIds.map(() => "(?, ?)").join(", ");
  const params = messageIds.flatMap((id) => [id, userId]);
  await getPool().query(
    `INSERT IGNORE INTO hidden_messages (message_id, user_id) VALUES ${values}`,
    params
  );
}

export async function markDeliveredForUser(userId) {
  const [rows] = await getPool().query(
    `SELECT id, chat_room_id AS chatRoomId, sender_id AS senderId
     FROM messages
     WHERE delivered = 0
     AND sender_id <> ?
     AND chat_room_id IN (
       SELECT room_id FROM chat_room_members WHERE user_id = ?
     )`,
    [userId, userId]
  );

  if (!rows.length) return [];

  await getPool().query("UPDATE messages SET delivered = 1 WHERE id IN (?)", [
    rows.map((row) => row.id),
  ]);

  const grouped = new Map();
  rows.forEach((row) => {
    const key = `${row.senderId}-${row.chatRoomId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        senderId: Number(row.senderId),
        chatRoomId: Number(row.chatRoomId),
        messageIds: [],
      });
    }
    grouped.get(key).messageIds.push(Number(row.id));
  });

  return Array.from(grouped.values());
}

export async function markRoomSeen(roomId, userId) {
  const [rows] = await getPool().query(
    `SELECT id
     FROM messages m
     WHERE chat_room_id = ?
     AND sender_id <> ?
     AND seen = 0
     AND NOT EXISTS (
       SELECT 1 FROM hidden_messages h
       WHERE h.message_id = m.id AND h.user_id = ?
     )`,
    [roomId, userId, userId]
  );

  if (!rows.length) return [];

  const ids = rows.map((row) => Number(row.id));
  await getPool().query("UPDATE messages SET seen = 1, delivered = 1 WHERE id IN (?)", [ids]);
  return ids;
}

export const createMessage = async (req, res) => {
  const chatRoomId = Number(req.body.chatRoomId);
  const message = String(req.body.message || "").trim();

  if (!chatRoomId || !message) {
    return res.status(400).json({ message: "Message is required" });
  }

  try {
    const allowed = await isMember(chatRoomId, req.user.id);
    if (!allowed) {
      return res.status(403).json({ message: "You are not in this chat" });
    }

    const receiverId = await otherMemberId(chatRoomId, req.user.id);
    const delivered = receiverId && isOnline(receiverId) ? 1 : 0;

    const [result] = await getPool().query(
      "INSERT INTO messages (chat_room_id, sender_id, message, delivered, seen) VALUES (?, ?, ?, ?, 0)",
      [chatRoomId, req.user.id, message, delivered]
    );

    const [rows] = await getPool().query(
      `SELECT id, chat_room_id AS chatRoomId, sender_id AS sender, message,
              delivered, seen, created_at AS createdAt
       FROM messages WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(toMessage(rows[0]));
  } catch (error) {
    res.status(500).json({ message: "Could not send message" });
  }
};

export const getMessages = async (req, res) => {
  const chatRoomId = Number(req.params.chatRoomId);

  try {
    const allowed = await isMember(chatRoomId, req.user.id);
    if (!allowed) {
      return res.status(403).json({ message: "You are not in this chat" });
    }

    const seenMessageIds = await markRoomSeen(chatRoomId, req.user.id);

    const [rows] = await getPool().query(
      `SELECT id, chat_room_id AS chatRoomId, sender_id AS sender, message,
              delivered, seen, created_at AS createdAt
       FROM messages m
       WHERE chat_room_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM hidden_messages h
         WHERE h.message_id = m.id AND h.user_id = ?
       )
       ORDER BY created_at ASC, id ASC`,
      [chatRoomId, req.user.id]
    );

    res.json({
      messages: rows.map(toMessage),
      seenMessageIds,
    });
  } catch (error) {
    res.status(500).json({ message: "Could not load messages" });
  }
};

export const markSeen = async (req, res) => {
  const chatRoomId = Number(req.body.chatRoomId);

  try {
    const allowed = await isMember(chatRoomId, req.user.id);
    if (!allowed) {
      return res.status(403).json({ message: "You are not in this chat" });
    }

    const messageIds = await markRoomSeen(chatRoomId, req.user.id);
    res.json({ chatRoomId, messageIds });
  } catch (error) {
    res.status(500).json({ message: "Could not update seen messages" });
  }
};

export const removeMessages = async (req, res) => {
  const chatRoomId = Number(req.body.chatRoomId);
  const scope = req.body.scope === "everyone" ? "everyone" : "me";
  const messageIds = [...new Set((req.body.messageIds || []).map(Number).filter(Boolean))];

  if (!chatRoomId || !messageIds.length) {
    return res.status(400).json({ message: "Select at least one message" });
  }

  try {
    const allowed = await isMember(chatRoomId, req.user.id);
    if (!allowed) {
      return res.status(403).json({ message: "You are not in this chat" });
    }

    const [rows] = await getPool().query(
      "SELECT id, sender_id FROM messages WHERE chat_room_id = ? AND id IN (?)",
      [chatRoomId, messageIds]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (scope === "everyone") {
      const notMine = rows.some((row) => Number(row.sender_id) !== req.user.id);
      if (notMine) {
        return res.status(403).json({ message: "You can only delete your own messages for everyone" });
      }

      const ids = rows.map((row) => Number(row.id));
      await getPool().query("DELETE FROM messages WHERE id IN (?)", [ids]);
      const otherId = await otherMemberId(chatRoomId, req.user.id);

      return res.json({
        chatRoomId,
        removedIds: ids,
        scope,
        lastMessage: await latestVisibleMessage(chatRoomId, req.user.id),
        otherLastMessage: otherId ? await latestVisibleMessage(chatRoomId, otherId) : "",
      });
    }

    const ids = rows.map((row) => Number(row.id));
    await hideMessages(ids, req.user.id);

    res.json({
      chatRoomId,
      removedIds: ids,
      scope,
      lastMessage: await latestVisibleMessage(chatRoomId, req.user.id),
    });
  } catch (error) {
    res.status(500).json({ message: "Could not delete messages" });
  }
};

export const clearChat = async (req, res) => {
  const chatRoomId = Number(req.body.chatRoomId);

  try {
    const allowed = await isMember(chatRoomId, req.user.id);
    if (!allowed) {
      return res.status(403).json({ message: "You are not in this chat" });
    }

    const [rows] = await getPool().query("SELECT id FROM messages WHERE chat_room_id = ?", [
      chatRoomId,
    ]);

    await hideMessages(
      rows.map((row) => Number(row.id)),
      req.user.id
    );

    res.json({ chatRoomId, lastMessage: "" });
  } catch (error) {
    res.status(500).json({ message: "Could not clear chat" });
  }
};
