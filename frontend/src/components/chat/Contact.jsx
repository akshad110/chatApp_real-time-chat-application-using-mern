import { useState, useEffect } from "react";

import { getUser } from "../../services/ChatService";
import UserLayout from "../layouts/UserLayout";

export default function Contact({ chatRoom, onlineUsersId, currentUser, lastMessage, unread }) {
  const [contact, setContact] = useState();

  useEffect(() => {
    const contactId = chatRoom.members?.find(
      (member) => member !== currentUser.uid
    );

    if (!contactId) return;

    const fetchData = async () => {
      try {
        const res = await getUser(contactId);
        setContact(res);
      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
  }, [chatRoom, currentUser]);

  return (
    <UserLayout
      user={contact}
      onlineUsersId={onlineUsersId}
      subtitle={lastMessage}
      unread={unread}
    />
  );
}
