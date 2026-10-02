# Let's Chat — Architecture and Request Flow

This is the interview walkthrough of how the app is built and how a request moves through it. The short version: the React app talks to Express over HTTP for anything that must be saved, and over Socket.io for anything that must appear on the other person's screen immediately.

## How to open the explanation

The product is a one-to-one chat app.

- The frontend is a React single-page app. It handles screens, local state, and the open socket.
- The backend is an Express API plus a Socket.io server on the same Node process.
- MySQL is the source of truth for users, rooms, and messages.
- A JWT in `localStorage` proves who the caller is. The password hash and the token secret never leave the server.

HTTP is used when the result must survive a refresh: register, login, profile, room list, message history, send, seen, delete, clear chat.

Sockets are used only to push that already-saved result to the other user: new message, typing, delivered ticks, seen ticks, and "deleted for everyone".

If the socket drops, the next page load still shows the correct chat, because the message was written to MySQL before the socket event was emitted.

## Repository layout

```
lets-chat-main/
  frontend/          React + Vite. Own package.json, .env, node_modules
  server/            Express + Socket.io. Own package.json, .env, node_modules
```

There is no shared root package. Each side is deployed as its own service.

| Side | Local command | Default URL |
| --- | --- | --- |
| Frontend | `npm start` in `frontend` | `http://localhost:3000` |
| Server | `npm run dev` in `server` | `http://localhost:3001` |

The frontend reads `VITE_API_URL`. Axios calls `${VITE_API_URL}/api/...`. The socket connects to the same origin, without `/api`. The server reads `CLIENT_URL` and allows only that origin in CORS.

## Frontend shape

```
src/index.jsx
  App.jsx
    AuthProvider          current user, token, login, register, logout
      Header
      Routes
        /login            public
        /register         public
        /profile          private
        /                 private ChatLayout
```

`WithPrivateRoute` checks `currentUser`. If it is missing, the user is sent to `/login`.

`AuthContext` is the only place that writes the token. On load it reads `localStorage.token` and calls `GET /api/user/me`. A bad or expired token is removed and the user is treated as logged out. Every later Axios request attaches `Authorization: Bearer <token>` from that same key.

`ChatLayout` owns the chat screen state:

- the user list
- the room list and each room's last message
- which room is open
- who is online
- unread room ids
- one socket for the logged-in user
- the latest live message, passed down into the open room

`ChatRoom` owns the open conversation: history, ticks, selection, the three-dot menu, and the composer. `ChatService.js` is the only frontend file that calls the API or opens the socket.

## Backend shape

```
index.js
  GET /                         health check, no token
  /api/auth                     register and login, no token
  VerifyToken                   everything below this line
  /api/room
  /api/message
  /api/user
  Socket.io on the same HTTP server
    VerifySocketToken on handshake
```

`VerifyToken` reads the Bearer token, checks it with `JWT_SECRET`, and sets `req.user.id`. The client never chooses the sender id. Controllers use `req.user.id`, so a user cannot post a message as someone else.

The socket middleware does the same check on `socket.handshake.auth.token` and sets `socket.user.id`. A connection without a valid token is rejected.

On startup `connectDB()` opens a MySQL pool, creates the database if it is missing, then creates the tables if they are missing. The server does not listen until that succeeds.

## Data model

Five tables. The server creates them on boot.

**users**

`id`, `email` (unique), `password` (bcrypt hash), `display_name`, `photo_url`.

The API never returns the password. Public user objects look like `{ uid, email, displayName, photoURL }`. `uid` is the numeric MySQL id, kept under that name so the React screens stay simple.

**chat_rooms**

`id`, `created_at`. A room has no name. It is just the container for two people.

**chat_room_members**

`(room_id, user_id)` primary key. Every chat inserts two rows: the current user and the person they picked. Creating a room first looks for an existing pair, so the same two people do not get a second room.

**messages**

`id`, `chat_room_id`, `sender_id`, `message`, `delivered`, `seen`, `created_at`.

- `delivered = 0`, `seen = 0` means sent. The other person was offline. UI shows one gray tick.
- `delivered = 1`, `seen = 0` means it reached an online client and was not opened. UI shows two gray ticks.
- `seen = 1` means the other person opened that room. UI shows two blue ticks. Seen also forces delivered to 1.

**hidden_messages**

`(message_id, user_id)`. This is "delete for me" and "clear chat". The row stays in `messages` for the other person. Queries that load history or the last-message preview exclude rows present in this table for the current user.

"Delete for everyone" is different: those rows are removed from `messages`. The foreign key cascade also removes any hide rows.

## Auth flow

1. User submits email and password on `/register` or `/login`.
2. Frontend `POST /api/auth/register` or `POST /api/auth/login`.
3. Register checks the email is new, hashes the password with bcrypt (cost 10), and inserts the user.
4. Login loads the row and `bcrypt.compare`s the password. Wrong email and wrong password return the same 401, so the API does not reveal which one failed.
5. The server signs `{ id: userId }` with `JWT_SECRET`, expiry 7 days.
6. The response is `{ token, user }`. The frontend stores the token and sets `currentUser`.
7. Later visits call `GET /api/user/me` with the Bearer token and restore `currentUser` from the database, not from a cached profile object.

Profile update is `PUT /api/user/profile` with `displayName` and `photoURL`. The photo is a DiceBear URL stored as text. The server updates only the row for `req.user.id`.

## Opening the app after login

1. `ChatLayout` mounts because `/` is private and `currentUser` exists.
2. It calls `GET /api/room/:userId`. The server refuses the call unless `:userId` is the token user. The response is that user's rooms, each with both member ids and the last message that is still visible to them.
3. It calls `GET /api/user`. That returns every user except the password, ordered for the search list.
4. It opens one Socket.io connection to `VITE_API_URL` with the JWT in `auth.token`.
5. The server verifies the token, stores `onlineUsers.set(userId, socket.id)`, and joins the socket to a room named `user:<id>`.
6. It broadcasts `getUsers` with the list of online ids. Every connected client uses that list for the green dot.
7. If this user has undelivered incoming messages, the server marks them `delivered = 1` and emits `messagesDelivered` to each sender's `user:<id>` room. That is how a single gray tick becomes a double gray tick when the recipient comes online, even if they do not open the chat.

Search does not hit the server again. It filters the already loaded users by name or email, and filters rooms to the people who matched.

## Starting a chat

1. The user clicks someone who is not already a room.
2. Frontend `POST /api/room` with `{ receiverId }`.
3. The server rejects chatting with yourself, rejects an unknown user, and returns the existing room if those two ids are already members together.
4. Otherwise it inserts one `chat_rooms` row and two `chat_room_members` rows, then returns the room.
5. The frontend adds that room to the list and opens it.

## Sending a message

This is the flow to describe carefully. Persistence and realtime are two steps, in that order.

1. `ChatForm` submits the text.
2. `POST /api/message` with `{ chatRoomId, message }`. The sender is `req.user.id`, not a field from the body.
3. The server checks the caller is a member of that room.
4. It looks up the other member. If that user is in the `onlineUsers` map, the insert uses `delivered = 1`. Otherwise `delivered = 0`. `seen` is always 0 at insert time.
5. MySQL returns the new row. The API responds `201` with the message.
6. The sender's screen appends that response immediately. It does not wait for a socket echo of its own message.
7. The sender then emits `sendMessage` with the new id, text, room id, and receiver id.
8. The server does not write anything in that handler. It emits `getMessage` to `user:<receiverId>`.
9. The receiver's `ChatLayout` hears `getMessage`. It updates the sidebar last message. If that room is not the open one, it adds an unread dot. It also stores the payload as `liveMessage`.
10. If `ChatRoom` is open on that room, it appends the message when the id is not already in the list, then calls `POST /api/message/seen`.

Joining `user:<id>` on connect is what makes delivery reliable. The server does not have to look up a socket id that might be stale. Any tab connected as that user is in the room.

## Read ticks

Ticks are rendered only on the sender's own bubbles.

| State | Database | What the sender sees |
| --- | --- | --- |
| Sent while the other user is offline | `delivered = 0`, `seen = 0` | one gray tick |
| Other user is online, chat not open | `delivered = 1`, `seen = 0` | two gray ticks |
| Other user opened the chat | `seen = 1` (and `delivered = 1`) | two blue ticks |

Seen is written when the recipient loads the room (`GET /api/message/:chatRoomId` marks incoming unseen rows) or when a live message arrives in the already open room (`POST /api/message/seen`).

The recipient's client then emits `messagesSeen` with those ids. The server forwards that to the sender's user room. The sender flips those bubbles to blue without refetching the thread.

Delivered is written in two places: at insert time if the recipient is already online, and on the recipient's socket connect for anything still undelivered. The `messagesDelivered` event updates the sender's open thread the same way.

## Typing

Typing is not stored.

While the composer is non-empty, the client emits `typing` to the other user. Clearing the box or sending emits `stopTyping`. The other `ChatRoom` shows "typing..." only if the event's room id matches the open chat, and it clears the label after 1.5 seconds of silence so a dropped `stopTyping` cannot leave it stuck.

## Delete and clear

Selection is local UI state. There is no per-message delete button. After one or more bubbles are selected, the bar offers:

**Delete for me** — `POST /api/message/remove` with `scope: "me"`. The server inserts `hidden_messages` for the caller only. The other person's copy stays. The sidebar last message is recomputed from what this user can still see. No socket event is required, because the other screen did not change.

**Delete for everyone** — same route with `scope: "everyone"`. Allowed only when every selected row has `sender_id` equal to the caller. The server `DELETE`s those messages, returns the new last message for both people, and the client emits `deleteMessage`. The other open chat removes those ids and the sidebar updates.

**Clear chat** — `POST /api/message/clear`. Hides every message in the room for the current user only. The other person still has the history.

**Close chat** and **Select messages** are UI-only. Search messages filters the open thread in memory.

## Online status

`onlineUsers` is an in-memory `Map` of `userId -> socket.id`. It is not in MySQL, so a server restart clears it and the next connect fills it again.

On connect the user is added and `getUsers` is broadcast. On disconnect the map entry is removed only if it still points at that socket id, so a second tab reconnecting cannot be marked offline by the first tab closing.

The green dot is "this user id is in the latest `getUsers` list". It is presence, not "currently looking at this room".

## What is protected

- Passwords are bcrypt hashes. The public user mapper never selects the password column except inside login, where it is compared and dropped.
- JWT is checked on every private HTTP route and on the socket handshake.
- Room and message handlers call `isMember` before reading or writing.
- A user can load only their own room list (`GET /room/:userId` must match the token).
- Delete for everyone cannot remove the other person's messages.
- Socket handlers emit to `user:<receiverId>`. They do not trust the client for the sender id. The sender is `socket.user.id`.

## One sentence per feature, if the interviewer asks "walk me through X"

**Register.** Hash the password, insert the user, return a 7-day JWT.

**Login.** Compare the hash, return a JWT, and on the next visit rebuild the user from `GET /user/me`.

**Chat list.** Rooms the user belongs to, plus the latest message that is not in `hidden_messages` for them.

**Send.** Save in MySQL first, then tell the other user's socket room.

**Ticks.** `delivered` means their socket is connected. `seen` means they opened the room. The socket only notifies the sender so the ticks change live.

**Unread dot.** A `getMessage` whose room is not the open room. Opening the room removes that id.

**Delete for me.** A hide row. Delete for everyone is a real delete, and only of your own messages, followed by a socket event.

**Why both HTTP and sockets.** HTTP is the record. The socket is the notification. Refresh reads the record, so a missed event does not lose the chat.
