import { useEffect } from "react";

const typeStyles = {
  success: "border-green-300 bg-green-50 text-green-800",
  error: "border-red-300 bg-red-50 text-red-800",
  warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
  info: "border-blue-300 bg-blue-50 text-blue-800",
};

function Toast({ message, type = "info", onClose, duration = 3000 }) {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div
      className={`min-w-[250px] max-w-sm rounded-lg border p-4 shadow-lg transition-all ${typeStyles[type]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{message}</span>

        <button
          onClick={onClose}
          className="text-xs opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default Toast;