import { CadViewer } from "./components/CadViewer";
import { ChatPanel } from "./components/ChatPanel";
import { DrawingOverlay } from "./components/DrawingOverlay";
import { useWebSocket } from "./hooks/useWebSocket";
import "./App.css";

const WS_URL =
  (window.location.protocol === "https:" ? "wss://" : "ws://") +
  window.location.host +
  "/ws";

export default function App() {
  const { connected, messages, sendMessage } = useWebSocket(WS_URL);

  return (
    <div className="app">
      <div className="viewport">
        <CadViewer />
        <DrawingOverlay />
      </div>
      <ChatPanel connected={connected} messages={messages} onSend={sendMessage} />
    </div>
  );
}
