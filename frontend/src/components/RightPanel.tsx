import { useState } from "react";
import type { WSMessage } from "../types";
import FeaturesPanel from "./FeaturesPanel";
import FaceListPanel from "./FaceListPanel";
import { ChatPanel } from "./ChatPanel";

type TabId = "features" | "facelist" | "chat";

interface RightPanelProps {
  connected: boolean;
  messages: WSMessage[];
  onSend: (message: WSMessage) => void;
}

export default function RightPanel({ connected, messages, onSend }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("features");

  return (
    <div className="right-panel">
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === "features" ? "panel-tab-active" : ""}`}
          onClick={() => setActiveTab("features")}
        >
          Features
        </button>
        <button
          className={`panel-tab ${activeTab === "facelist" ? "panel-tab-active" : ""}`}
          onClick={() => setActiveTab("facelist")}
        >
          Face List
        </button>
        <button
          className={`panel-tab ${activeTab === "chat" ? "panel-tab-active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          Chat
          <span
            className="status-dot"
            style={{
              background: connected ? "#4caf50" : "#f44336",
              marginLeft: 6,
            }}
          />
        </button>
      </div>

      <div className="panel-content">
        {activeTab === "features" && <FeaturesPanel />}
        {activeTab === "facelist" && <FaceListPanel />}
        {activeTab === "chat" && (
          <ChatPanel connected={connected} messages={messages} onSend={onSend} />
        )}
      </div>
    </div>
  );
}
