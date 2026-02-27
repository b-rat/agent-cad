import { FormEvent, useEffect, useRef, useState } from "react";
import type { WSMessage } from "../types";

interface ChatPanelProps {
  connected: boolean;
  messages: WSMessage[];
  onSend: (message: WSMessage) => void;
}

export function ChatPanel({ connected, messages, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clear waiting state when an assistant message arrives
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.type === "chat" && "role" in last && last.role === "assistant") {
      setWaiting(false);
    }
    // Also clear on system error messages
    if (last && last.type === "system" && "content" in last && last.content.includes("error")) {
      setWaiting(false);
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waiting]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    onSend({ type: "chat", role: "user", content: text });
    setInput("");
    setWaiting(true);
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
        {waiting && (
          <div className="chat-msg assistant thinking">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={!connected || waiting}
        />
        <button type="submit" disabled={!connected || waiting}>
          Send
        </button>
      </form>
    </div>
  );
}
