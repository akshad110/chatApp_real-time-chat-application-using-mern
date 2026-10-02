export default function UserLayout({ user, onlineUsersId, subtitle, unread }) {
  return (
    <div className="relative flex w-full items-center">
      {user?.photoURL ? (
        <img className="h-10 w-10 rounded-full" src={user.photoURL} alt="" />
      ) : (
        <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
      )}
      <div className="ml-2 min-w-0 flex-1">
        <span className="block truncate text-gray-500 dark:text-gray-400">
          {user?.displayName || user?.email}
        </span>
        {subtitle ? (
          <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
            {subtitle}
          </span>
        ) : null}
      </div>
      {unread ? (
        <span className="ml-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-600" />
      ) : null}
      {onlineUsersId?.includes(user?.uid) ? (
        <span className="absolute bottom-0 left-7 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:bg-green-400"></span>
      ) : (
        <span className="absolute bottom-0 left-7 h-3.5 w-3.5 rounded-full border-2 border-white bg-gray-400"></span>
      )}
    </div>
  );
}
