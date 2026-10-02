import jwt from "jsonwebtoken";

function readUser(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return { id: Number(decoded.id) };
}

export const VerifyToken = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    req.user = readUser(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const VerifySocketToken = (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Unauthorized"));
  }

  try {
    socket.user = readUser(token);
    return next();
  } catch (error) {
    return next(new Error("Unauthorized"));
  }
};
