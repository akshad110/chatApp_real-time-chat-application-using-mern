import { useEffect, useRef, useState } from "react";

import {
  getAllUsers,
  getChatRooms,
  initiateSocketConnection,
} from "../../services/ChatService";
import { useAuth } from "../../contexts/AuthContext";

import ChatRoom from "../chat/ChatRoom";
import Welcome from "../chat/Welcome";
import AllUsers from "../chat/AllUsers";
import SearchUsers from "../chat/SearchUsers";

export default function ChatLayout() {
  const [users, setUsers] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [currentChat, setCurrentChat] = useState();
  const [onlineUsersId, setOnlineUsersId] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadRoomIds, setUnreadRoomIds] = useState([]);
  const [socketReady, setSocketReady] = useState(false);
  const [liveMessage, setLiveMessage] = useState(null);

  const socket = useRef();
  const currentChatRef = useRef();
  const { currentUser } = useAuth();

  currentChatRef.current = currentChat;

  const updateLastMessage = (roomId, text) => {
    setChatRooms((prev) =>
      prev.map((room) =>
        room.id === Number(roomId) ? { ...room, lastMessage: text || "" } : room
      )
    );
  };

  const openChat = (chat) => {
    setCurrentChat(chat);
    setUnreadRoomIds((prev) => prev.filter((id) => id !== chat.id));
  };

  useEffect(() => {
    let active = true;
    const socketConnection = initiateSocketConnection();
    socket.current = socketConnection;

    const onConnect = () => {
      if (!active) return;
      socketConnection.emit("addUser");
      setSocketReady(true);
    };

    socketConnection.on("connect", onConnect);
    if (socketConnection.connected) onConnect();

    socketConnection.on("getUsers", (ids) => {
      if (active) {
        setOnlineUsersId((ids || []).map((id) => Number(id)));
      }
    });

    socketConnection.on("getMessage", (data) => {
      if (!active) return;
      const roomId = Number(data.chatRoomId);
      setLiveMessage({ ...data, receivedAt: Date.now() });
      updateLastMessage(roomId, data.message);
      if (currentChatRef.current?.id !== roomId) {
        setUnreadRoomIds((prev) => (prev.includes(roomId) ? prev : [...prev, roomId]));
      }
    });

    socketConnection.on("messageDeleted", (data) => {
      if (!active) return;
      updateLastMessage(data.chatRoomId, data.lastMessage);
    });

    return () => {
      active = false;
      setSocketReady(false);
      socketConnection.disconnect();
      socket.current = null;
    };
  }, [currentUser.uid]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getChatRooms(currentUser.uid);
        setChatRooms(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error(error);
        setChatRooms([]);
      }
    };

    fetchData();
  }, [currentUser.uid]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getAllUsers();
        setUsers(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error(error);
        setUsers([]);
      }
    };

    fetchData();
  }, []);

  const query = searchQuery.trim().toLowerCase();
  const matchedUsers = query
    ? users.filter((user) =>
        `${user.displayName || ""} ${user.email || ""}`.toLowerCase().includes(query)
      )
    : users;

  const matchedIds = new Set(matchedUsers.map((user) => user.uid));
  const visibleRooms = query
    ? chatRooms.filter((room) =>
        room.members?.some((id) => id !== currentUser.uid && matchedIds.has(id))
      )
    : chatRooms;

  const visibleContactIds = new Set(
    visibleRooms.flatMap((room) => (room.members || []).filter((id) => id !== currentUser.uid))
  );

  const visibleUsers = query
    ? matchedUsers.filter(
        (user) => user.uid !== currentUser.uid && !visibleContactIds.has(user.uid)
      )
    : users;

  return (
    <div className="container mx-auto">
      <div className="min-w-full bg-white border-x border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded lg:grid lg:grid-cols-3">
        <div className="bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-700 lg:col-span-1">
          <SearchUsers handleSearch={setSearchQuery} />

          <AllUsers
            users={visibleUsers}
            chatRooms={visibleRooms}
            setChatRooms={setChatRooms}
            onlineUsersId={onlineUsersId}
            currentUser={currentUser}
            currentChatId={currentChat?.id}
            unreadRoomIds={unreadRoomIds}
            changeChat={openChat}
          />
        </div>

        {currentChat ? (
          <ChatRoom
            currentChat={currentChat}
            currentUser={currentUser}
            socket={socket}
            socketReady={socketReady}
            liveMessage={liveMessage}
            onlineUsersId={onlineUsersId}
            onLastMessageChange={updateLastMessage}
            onCloseChat={() => setCurrentChat(undefined)}
          />
        ) : (
          <Welcome />
        )}
      </div>
    </div>
  );
}
