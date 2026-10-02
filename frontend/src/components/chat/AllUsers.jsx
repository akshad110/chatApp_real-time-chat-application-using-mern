import { useState, useEffect } from "react";

import { createChatRoom } from "../../services/ChatService";
import { useAuth } from "../../contexts/AuthContext";
import Contact from "./Contact";
import UserLayout from "../layouts/UserLayout";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function AllUsers({
  users,
  chatRooms,
  setChatRooms,
  onlineUsersId,
  currentUser,
  currentChatId,
  unreadRoomIds,
  changeChat,
}) {
  const [nonContacts, setNonContacts] = useState([]);
  const [contactIds, setContactIds] = useState([]);
  const { setError } = useAuth();

  const rooms = chatRooms || [];
  const people = users || [];

  useEffect(() => {
    const ids = rooms.map((chatRoom) => {
      return chatRoom.members?.find((member) => member !== currentUser.uid);
    });
    setContactIds(ids);
  }, [rooms, currentUser.uid]);

  useEffect(() => {
    setNonContacts(
      people.filter((user) => user.uid !== currentUser.uid && !contactIds.includes(user.uid))
    );
  }, [contactIds, people, currentUser.uid]);

  const changeCurrentChat = (chat) => {
    changeChat(chat);
  };

  const handleNewChatRoom = async (user) => {
    try {
      const res = await createChatRoom({
        senderId: currentUser.uid,
        receiverId: user.uid,
      });

      setChatRooms((prev) => {
        if (prev.some((room) => room.id === res.id)) return prev;
        return [...prev, res];
      });
      changeChat(res);
    } catch (error) {
      setError(error.response?.data?.message || "Could not start chat");
    }
  };

  return (
    <>
      <ul className="overflow-auto h-[30rem]">
        <h2 className="my-2 mb-2 ml-2 text-gray-900 dark:text-white">Chats</h2>
        <li>
          {rooms.map((chatRoom) => (
            <div
              key={chatRoom.id}
              className={classNames(
                chatRoom.id === currentChatId
                  ? "bg-gray-100 dark:bg-gray-700"
                  : "cursor-pointer border-b border-gray-200 bg-white transition duration-150 ease-in-out hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-700",
                "flex items-center px-3 py-2 text-sm"
              )}
              onClick={() => changeCurrentChat(chatRoom)}
            >
              <Contact
                chatRoom={chatRoom}
                onlineUsersId={onlineUsersId}
                currentUser={currentUser}
                lastMessage={chatRoom.lastMessage}
                unread={unreadRoomIds?.includes(chatRoom.id)}
              />
            </div>
          ))}
        </li>
        <h2 className="my-2 mb-2 ml-2 text-gray-900 dark:text-white">
          Other Users
        </h2>
        <li>
          {nonContacts.map((nonContact) => (
            <div
              key={nonContact.uid}
              className="flex items-center px-3 py-2 text-sm bg-white border-b border-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => handleNewChatRoom(nonContact)}
            >
              <UserLayout user={nonContact} onlineUsersId={onlineUsersId} />
            </div>
          ))}
        </li>
      </ul>
    </>
  );
}
