import { useState, useEffect, useRef } from "react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";

import {
  clearChat,
  getMessagesOfChatRoom,
  markMessagesSeen,
  removeMessages,
  sendMessage,
} from "../../services/ChatService";
import { useAuth } from "../../contexts/AuthContext";

import Message from "./Message";
import Contact from "./Contact";
import ChatForm from "./ChatForm";

export default function ChatRoom({
  currentChat,
  currentUser,
  socket,
  socketReady,
  liveMessage,
  onlineUsersId,
  onLastMessageChange,
  onCloseChat,
}) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const scrollRef = useRef();
  const typingTimer = useRef();
  const { setError } = useAuth();

  const receiverId = currentChat.members
    ?.map(Number)
    .find((member) => member !== Number(currentUser.uid));

  const emitToOther = (event, extra = {}) => {
    socket.current?.emit(event, {
      receiverId,
      chatRoomId: currentChat.id,
      ...extra,
    });
  };

  const tellSeen = (messageIds) => {
    if (!messageIds?.length) return;
    emitToOther("messagesSeen", { messageIds });
  };

  useEffect(() => {
    setIsTyping(false);
    setSelecting(false);
    setSelectedIds([]);
    setMenuOpen(false);
    setConfirmClear(false);
    setSearchOpen(false);
    setSearchText("");

    const fetchData = async () => {
      try {
        const res = await getMessagesOfChatRoom(currentChat.id);
        const list = Array.isArray(res) ? res : res.messages || [];
        setMessages(list);
        tellSeen(res.seenMessageIds);
      } catch (error) {
        console.error(error);
        setMessages([]);
      }
    };

    fetchData();
  }, [currentChat.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!liveMessage) return;
    if (Number(liveMessage.chatRoomId) !== Number(currentChat.id)) return;
    if (Number(liveMessage.senderId) === Number(currentUser.uid)) return;

    setMessages((prev) => {
      const messageId = Number(liveMessage.messageId);
      if (prev.some((item) => item.id === messageId)) return prev;
      return [
        ...prev,
        {
          id: messageId,
          sender: Number(liveMessage.senderId),
          message: liveMessage.message,
          createdAt: liveMessage.createdAt || new Date().toISOString(),
          delivered: true,
          seen: true,
        },
      ];
    });
    setIsTyping(false);

    markMessagesSeen(currentChat.id)
      .then((res) => tellSeen(res.messageIds))
      .catch((error) => console.error(error));
  }, [liveMessage]);

  useEffect(() => {
    const current = socket.current;
    if (!current) return;

    const onMessage = async (data) => {
      if (Number(data.chatRoomId) !== Number(currentChat.id)) return;
      if (Number(data.senderId) === Number(currentUser.uid)) return;

      setMessages((prev) => {
        const messageId = Number(data.messageId);
        if (prev.some((item) => item.id === messageId)) return prev;
        return [
          ...prev,
          {
            id: messageId,
            sender: Number(data.senderId),
            message: data.message,
            createdAt: data.createdAt || new Date().toISOString(),
            delivered: true,
            seen: true,
          },
        ];
      });
      setIsTyping(false);

      try {
        const res = await markMessagesSeen(currentChat.id);
        tellSeen(res.messageIds);
      } catch (error) {
        console.error(error);
      }
    };

    const onDeleted = (data) => {
      if (Number(data.chatRoomId) !== Number(currentChat.id)) return;
      const ids = (data.messageIds || []).map(Number);
      setMessages((prev) => prev.filter((item) => !ids.includes(item.id)));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    };

    const onTyping = (data) => {
      if (Number(data.chatRoomId) !== Number(currentChat.id)) return;
      if (Number(data.senderId) !== Number(receiverId)) return;
      setIsTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setIsTyping(false), 1500);
    };

    const onStopTyping = (data) => {
      if (Number(data.chatRoomId) !== Number(currentChat.id)) return;
      setIsTyping(false);
    };

    const onDelivered = (data) => {
      if (Number(data.chatRoomId) !== Number(currentChat.id)) return;
      const ids = (data.messageIds || []).map(Number);
      setMessages((prev) =>
        prev.map((item) => (ids.includes(item.id) ? { ...item, delivered: true } : item))
      );
    };

    const onSeen = (data) => {
      if (Number(data.chatRoomId) !== Number(currentChat.id)) return;
      const ids = (data.messageIds || []).map(Number);
      setMessages((prev) =>
        prev.map((item) =>
          ids.includes(item.id) ? { ...item, delivered: true, seen: true } : item
        )
      );
    };

    current.on("getMessage", onMessage);
    current.on("messageDeleted", onDeleted);
    current.on("typing", onTyping);
    current.on("stopTyping", onStopTyping);
    current.on("messagesDelivered", onDelivered);
    current.on("messagesSeen", onSeen);

    return () => {
      clearTimeout(typingTimer.current);
      current.off("getMessage", onMessage);
      current.off("messageDeleted", onDeleted);
      current.off("typing", onTyping);
      current.off("stopTyping", onStopTyping);
      current.off("messagesDelivered", onDelivered);
      current.off("messagesSeen", onSeen);
    };
  }, [socket, socketReady, currentChat, currentUser.uid, receiverId]);

  const handleTyping = (typing) => {
    emitToOther(typing ? "typing" : "stopTyping");
  };

  const handleFormSubmit = async (message) => {
    emitToOther("stopTyping");

    try {
      const res = await sendMessage({
        chatRoomId: currentChat.id,
        message,
      });
      setMessages((prev) => [...prev, res]);
      onLastMessageChange?.(currentChat.id, res.message);
      emitToOther("sendMessage", {
        message: res.message,
        messageId: res.id,
        createdAt: res.createdAt,
      });
    } catch (error) {
      setError(error.response?.data?.message || "Failed to send message");
    }
  };

  const toggleSelected = (message) => {
    setSelectedIds((prev) =>
      prev.includes(message.id) ? prev.filter((id) => id !== message.id) : [...prev, message.id]
    );
  };

  const selectedMessages = messages.filter((item) => selectedIds.includes(item.id));
  const allMine =
    selectedMessages.length > 0 &&
    selectedMessages.every((item) => Number(item.sender) === Number(currentUser.uid));

  const handleRemove = async (scope) => {
    try {
      const res = await removeMessages(currentChat.id, selectedIds, scope);
      const removed = (res.removedIds || []).map(Number);
      setMessages((prev) => prev.filter((item) => !removed.includes(item.id)));
      setSelectedIds([]);
      setSelecting(false);
      onLastMessageChange?.(currentChat.id, res.lastMessage);
      if (scope === "everyone") {
        emitToOther("deleteMessage", {
          messageIds: res.removedIds,
          lastMessage: res.otherLastMessage,
        });
      }
    } catch (error) {
      setError(error.response?.data?.message || "Could not delete messages");
    }
  };

  const handleClear = async () => {
    try {
      const res = await clearChat(currentChat.id);
      setMessages([]);
      setSelectedIds([]);
      setSelecting(false);
      setConfirmClear(false);
      setMenuOpen(false);
      onLastMessageChange?.(currentChat.id, res.lastMessage);
    } catch (error) {
      setError(error.response?.data?.message || "Could not clear chat");
    }
  };

  const visibleMessages = searchText.trim()
    ? messages.filter((item) =>
        item.message.toLowerCase().includes(searchText.trim().toLowerCase())
      )
    : messages;

  return (
    <div className="lg:col-span-2 lg:block">
      <div className="w-full">
        <div className="border-b border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Contact
                chatRoom={currentChat}
                currentUser={currentUser}
                onlineUsersId={onlineUsersId}
              />
              {isTyping ? (
                <p className="ml-12 text-xs text-blue-600 dark:text-blue-400">typing...</p>
              ) : null}
            </div>
            <div className="relative">
              <button
                type="button"
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => {
                  setMenuOpen((open) => !open);
                  setConfirmClear(false);
                }}
              >
                <EllipsisVerticalIcon className="h-6 w-6" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {confirmClear ? (
                    <div className="px-3 py-2">
                      <p className="mb-2 text-gray-600 dark:text-gray-300">Clear this chat for you?</p>
                      <div className="flex justify-end gap-2">
                        <button type="button" className="text-gray-500" onClick={() => setConfirmClear(false)}>
                          No
                        </button>
                        <button type="button" className="text-red-500" onClick={handleClear}>
                          Yes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setConfirmClear(true)}>
                        Clear chat
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => {
                          setSearchOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        Search messages
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => {
                          setSelecting(true);
                          setMenuOpen(false);
                        }}
                      >
                        Select messages
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => onCloseChat?.()}
                      >
                        Close chat
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {searchOpen ? (
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search in this chat"
              className="mt-3 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          ) : null}
        </div>

        {selecting ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
            <span className="text-gray-600 dark:text-gray-300">
              {selectedIds.length ? `${selectedIds.length} selected` : "Tap messages to select"}
            </span>
            <div className="flex items-center gap-3">
              {selectedIds.length ? (
                <>
                  <button type="button" className="text-red-500" onClick={() => handleRemove("me")}>
                    Delete for me
                  </button>
                  <button
                    type="button"
                    className={allMine ? "text-red-500" : "cursor-not-allowed text-gray-400"}
                    disabled={!allMine}
                    title={allMine ? "Delete for everyone" : "Only your own messages can be deleted for everyone"}
                    onClick={() => handleRemove("everyone")}
                  >
                    Delete for everyone
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="text-gray-500"
                onClick={() => {
                  setSelecting(false);
                  setSelectedIds([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative h-[30rem] w-full overflow-y-auto border-b border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <ul className="space-y-2">
            {visibleMessages.map((message, index) => (
              <div key={message.id || index} ref={scrollRef}>
                <Message
                  message={message}
                  self={currentUser.uid}
                  selectable={selecting}
                  selected={selectedIds.includes(message.id)}
                  onToggle={toggleSelected}
                />
              </div>
            ))}
          </ul>
        </div>

        <ChatForm handleFormSubmit={handleFormSubmit} onTyping={handleTyping} />
      </div>
    </div>
  );
}
