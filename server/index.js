import "./config/env.js";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";

import { connectDB } from "./config/db.js";
import { onlineUsers } from "./onlineUsers.js";
import { markDeliveredForUser } from "./controllers/chatMessage.js";
import { VerifyToken, VerifySocketToken } from "./middlewares/VerifyToken.js";
import authRoutes from "./routes/auth.js";
import chatRoomRoutes from "./routes/chatRoom.js";
import chatMessageRoutes from "./routes/chatMessage.js";
import userRoutes from "./routes/user.js";

const app = express();

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use(VerifyToken);
app.use("/api/room", chatRoomRoutes);
app.use("/api/message", chatMessageRoutes);
app.use("/api/user", userRoutes);

try {
  await connectDB();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use(VerifySocketToken);

const broadcastOnlineUsers = () => {
  io.emit("getUsers", Array.from(onlineUsers.keys()));
};

const userRoom = (userId) => `user:${Number(userId)}`;

io.on("connection", async (socket) => {
  const userId = Number(socket.user.id);
  onlineUsers.set(userId, socket.id);
  socket.join(userRoom(userId));
  broadcastOnlineUsers();

  try {
    const updates = await markDeliveredForUser(userId);
    updates.forEach((update) => {
      io.to(userRoom(update.senderId)).emit("messagesDelivered", {
        chatRoomId: update.chatRoomId,
        messageIds: update.messageIds,
      });
    });
  } catch (error) {
    console.error(error);
  }

  socket.on("addUser", () => {
    onlineUsers.set(userId, socket.id);
    broadcastOnlineUsers();
  });

  socket.on("sendMessage", ({ receiverId, chatRoomId, message, messageId, createdAt }) => {
    io.to(userRoom(receiverId)).emit("getMessage", {
      senderId: userId,
      chatRoomId: Number(chatRoomId),
      message,
      messageId: Number(messageId),
      createdAt,
    });
  });

  socket.on("typing", ({ receiverId, chatRoomId }) => {
    io.to(userRoom(receiverId)).emit("typing", {
      senderId: userId,
      chatRoomId: Number(chatRoomId),
    });
  });

  socket.on("stopTyping", ({ receiverId, chatRoomId }) => {
    io.to(userRoom(receiverId)).emit("stopTyping", {
      senderId: userId,
      chatRoomId: Number(chatRoomId),
    });
  });

  socket.on("deleteMessage", ({ receiverId, chatRoomId, messageIds, lastMessage }) => {
    io.to(userRoom(receiverId)).emit("messageDeleted", {
      senderId: userId,
      chatRoomId: Number(chatRoomId),
      messageIds: (messageIds || []).map(Number),
      lastMessage: lastMessage || "",
    });
  });

  socket.on("messagesSeen", ({ receiverId, chatRoomId, messageIds }) => {
    io.to(userRoom(receiverId)).emit("messagesSeen", {
      senderId: userId,
      chatRoomId: Number(chatRoomId),
      messageIds: (messageIds || []).map(Number),
    });
  });

  socket.on("disconnect", () => {
    if (onlineUsers.get(userId) === socket.id) {
      onlineUsers.delete(userId);
    }
    broadcastOnlineUsers();
  });
});
