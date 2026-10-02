export const onlineUsers = new Map();

export function isOnline(userId) {
  return onlineUsers.has(Number(userId));
}
