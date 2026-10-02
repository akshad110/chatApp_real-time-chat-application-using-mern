# Let's Chat

A real-time chat application. Another fun side project :)

![Screenshot from 2022-09-07 16-27-25](https://user-images.githubusercontent.com/66206865/188901222-8eefabe5-8ca2-4305-aeb3-3afa37b304b3.png)

![Screenshot from 2022-09-07 17-11-16](https://user-images.githubusercontent.com/66206865/188900580-01d0d3ca-b242-4f48-99cf-96edeeb5f1db.png)

GIFs are attached at the end.

## Technologies Used

- React and TailwindCSS for the frontend
- Node/Express for the API
- MySQL for users, chat rooms, and messages
- Socket.io for real-time chat

## Basic Features

- Users can register and log in with email and password.
- Profile page where users can update their avatar and display name.
- Generate random avatars using [DiceBear API](https://avatars.dicebear.com/docs/http-api)
- Users can create a room to chat with others.
- Users can see online status.
- Search functionality.
- Chatting is real-time.
- Emoji picker is also integrated.
- Dark mode can be enabled.

## Getting Started

1. Create a MySQL user that can create a database, or use an existing one.
2. Copy the example env files and fill in your values:
   - In `server`, copy `.env.example` to `.env` and set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `JWT_SECRET`.
   - In `frontend`, copy `.env.example` to `.env`.
3. Install dependencies separately:
   - In the `server` directory, run `npm install`.
   - In the `frontend` directory, run `npm install`.
4. Start the server from the `server` directory with `npm run dev`.
   The server creates the database and tables if they do not exist.
5. Start the client from the `frontend` directory with `npm start`.
6. Open `http://localhost:3000`.

Do not commit the `.env` files. They hold the database password and JWT secret.

## GIFs

![chrome-capture-2022-8-7](https://user-images.githubusercontent.com/66206865/188901119-65a05b65-3c76-4c3f-92c5-042d061df8e1.gif)

![chrome-capture-2022-8-7 (1)](https://user-images.githubusercontent.com/66206865/188900841-2dfe91c2-eb78-4f70-a013-babe0124ee68.gif)

![chrome-capture-2022-8-7 (2)](https://user-images.githubusercontent.com/66206865/188900662-a120aef4-ced1-442b-98dd-ab90b4cea7b5.gif)
