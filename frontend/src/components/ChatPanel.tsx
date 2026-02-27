import { FormEvent, useState } from "react";
import type { WSMessage } from "../types";

interface ChatPanelProps {
  connected: boolean;
  messages: WSMessage[];
  onSend: (message: WSMessage) => void;
}

export function ChatPanel({ connected, messages, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    onSend({ type: "chat", role: "user", content: text });
    setInput("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages
          .filter((m) => m.type === "chat" || m.type === "system")
          .map((msg, i) => (
            <div
              key={i}
              className={`chat-msg ${msg.type === "system" ? "system" : (msg as { role: string }).role}`}
            >
              {"content" in msg ? msg.content : ""}
            </div>
          ))}
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={!connected}
        />
        <button type="submit" disabled={!connected}>
          Send
        </button>
      </form>
    </div>
  );
}
