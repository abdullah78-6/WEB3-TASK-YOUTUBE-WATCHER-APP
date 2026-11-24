import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

export default function ChatPanel({ messages, onSendMessage }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
  };

  return (
    <div className="flex flex-col h-[380px]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">
            No messages yet. Say hello to the watch party!
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-slate-800/80 bg-cinema-950/70 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] mb-0.5">
                <span className="font-semibold text-slate-200">
                  {m.username}{" "}
                  <span className="font-normal text-slate-400">({m.role})</span>
                </span>
                <span className="text-slate-500">
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-slate-300 break-words">{m.text}</p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Type a message..."
          className="flex-1 rounded-xl border border-slate-700 bg-cinema-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-3.5 py-2 text-white hover:bg-rose-500 transition"
          aria-label="Send chat message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
