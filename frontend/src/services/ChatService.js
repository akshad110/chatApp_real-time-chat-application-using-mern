import { io } from "socket.io-client";

import api, { API_URL } from "../config/api";

export const initiateSocketConnection = () => {
  const token = localStorage.getItem("token");

  return io(API_URL, {
    auth: {
      token,
    },
  });
};

export const getAllUsers = async () => {
  const res = await api.get("/user");
  return res.data;
};

export const getUser = async (userId) => {
  const res = await api.get(`/user/${userId}`);
  return res.data;
};

export const getChatRooms = async (userId) => {
  const res = await api.get(`/room/${userId}`);
  return res.data;
};

export const getChatRoomOfUsers = async (firstUserId, secondUserId) => {
  const res = await api.get(`/room/${firstUserId}/${secondUserId}`);
  return res.data;
};

export const createChatRoom = async (members) => {
  const res = await api.post("/room", members);
  return res.data;
};

export const getMessagesOfChatRoom = async (chatRoomId) => {
  const res = await api.get(`/message/${chatRoomId}`);
  return res.data;
};

export const sendMessage = async (messageBody) => {
  const res = await api.post("/message", messageBody);
  return res.data;
};

export const removeMessages = async (chatRoomId, messageIds, scope) => {
  const res = await api.post("/message/remove", { chatRoomId, messageIds, scope });
  return res.data;
};

export const markMessagesSeen = async (chatRoomId) => {
  const res = await api.post("/message/seen", { chatRoomId });
  return res.data;
};

export const clearChat = async (chatRoomId) => {
  const res = await api.post("/message/clear", { chatRoomId });
  return res.data;
};
