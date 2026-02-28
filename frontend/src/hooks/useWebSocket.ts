import { useCallback, useEffect, useRef, useState } from "react";
import type { WSMessage, CadCommandMessage, CadUpdateMessage } from "../types";
import { useModelStore } from "../store/useModelStore";
import type { ClipPlane } from "../store/useModelStore";

function handleCadCommand(msg: CadCommandMessage) {
  const store = useModelStore.getState();

  switch (msg.action) {
    case "select_faces":
      if (msg.face_ids) {
        for (const id of msg.face_ids) {
          store.selectFace(id, true); // shift=true to add to selection
        }
      }
      break;

    case "clear_selection":
      store.clearSelection();
      break;

    case "create_feature":
      if (msg.name) {
        store.createFeature(msg.name);
      }
      break;

    case "delete_feature":
      if (msg.name) {
        store.deleteFeature(msg.name);
      }
      break;

    case "set_display":
      if (msg.xray !== undefined) store.setXray(msg.xray);
      if (msg.wireframe !== undefined) store.setWireframe(msg.wireframe);
      if (msg.colors !== undefined) store.setColors(msg.colors);
      if (msg.clip_plane !== undefined) {
        store.setClipPlane(msg.clip_plane as ClipPlane);
      }
      if (msg.fit_all) store.fitAll();
      break;

    case "set_view":
      console.log("[WS] set_view received:", msg.view, msg.zoom);
      if (msg.view) {
        store.setView(msg.view, msg.zoom ?? 1.0);
      }
      break;
  }
}

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setConnected(true);
      };

      ws.onerror = () => {
        // Suppress console noise — onclose handles retry
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 2s unless unmounted
        if (!cancelled) {
          retryTimeout = setTimeout(connect, 2000);
        }
      };

      ws.onmessage = (event) => {
        const message: WSMessage = JSON.parse(event.data);

        // Intercept cad_command messages — dispatch to store, don't add to chat
        if (message.type === "cad_command") {
          handleCadCommand(message as CadCommandMessage);
          return;
        }

        // Handle screenshot requests — capture canvas and POST back
        if (message.type === "screenshot_request") {
          const canvas = document.querySelector("canvas");
          if (canvas) {
            const dataUrl = canvas.toDataURL("image/png");
            fetch("/api/screenshot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image: dataUrl }),
            });
          }
          return;
        }

        // Handle model updates broadcast from REST uploads (e.g. MCP server)
        if (message.type === "cad_update") {
          const update = message as CadUpdateMessage;
          const store = useModelStore.getState();
          store.loadModel(update.mesh, update.faces, update.info, update.filename);
          return;
        }

        setMessages((prev) => [...prev, message]);
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
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
