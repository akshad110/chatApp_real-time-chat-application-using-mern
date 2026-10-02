import { format } from "timeago.js";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ReadTicks({ delivered, seen }) {
  const seenTick = Boolean(seen);
  const double = Boolean(delivered) || seenTick;

  return (
    <span
      className={classNames(
        seenTick ? "text-blue-500" : "text-gray-400",
        "text-xs font-semibold tracking-tighter"
      )}
      title={seenTick ? "Seen" : double ? "Delivered" : "Sent"}
    >
      {double ? "✓✓" : "✓"}
    </span>
  );
}

export default function Message({ message, self, selected, selectable, onToggle }) {
  const mine = Number(self) === Number(message.sender);

  return (
    <li
      className={classNames(mine ? "justify-end" : "justify-start", "flex")}
      onClick={() => selectable && onToggle?.(message)}
    >
      <div
        className={classNames(
          selected ? "rounded-lg ring-2 ring-blue-400" : "",
          selectable ? "cursor-pointer" : "",
          "p-1"
        )}
      >
        <div
          className={classNames(
            mine
              ? "bg-blue-600 text-white dark:bg-blue-500"
              : "border border-gray-200 bg-white text-gray-700 shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400",
            "relative max-w-xl rounded-lg px-4 py-2 shadow"
          )}
        >
          <span className="block font-normal">{message.message}</span>
        </div>
        <div className={classNames(mine ? "justify-end" : "justify-start", "mt-1 flex items-center gap-2")}>
          <span className="block text-sm text-gray-700 dark:text-gray-400">
            {format(message.createdAt)}
          </span>
          {mine ? <ReadTicks delivered={message.delivered} seen={message.seen} /> : null}
        </div>
      </div>
    </li>
  );
}
