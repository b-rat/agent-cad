import { useCallback, useEffect, useRef, useState } from "react";
import type { WSMessage } from "../types";

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const message: WSMessage = JSON.parse(event.data);
      setMessages((prev) => [...prev, message]);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { connected, messages, sendMessage };
}
