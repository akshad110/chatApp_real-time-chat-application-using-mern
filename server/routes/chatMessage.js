import express from "express";

import {
  clearChat,
  createMessage,
  getMessages,
  markSeen,
  removeMessages,
} from "../controllers/chatMessage.js";

const router = express.Router();

router.post("/", createMessage);
router.post("/seen", markSeen);
router.post("/remove", removeMessages);
router.post("/clear", clearChat);
router.get("/:chatRoomId", getMessages);

export default router;
