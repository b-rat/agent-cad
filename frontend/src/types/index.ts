export interface ChatMessage {
  type: "chat";
  role: "user" | "assistant";
  content: string;
}

export interface CadMeshData {
  vertices: number[];
  faces: number[];
  normals: number[];
}

export interface FaceMetadata {
  id: number;
  type: string;
  area?: number;
}

export interface CadUpdateMessage {
  type: "cad_update";
  vertices: number[];
  faces: number[];
  normals: number[];
  metadata?: FaceMetadata[];
}

export interface DrawingMessage {
  type: "drawing";
  points: Array<{ x: number; y: number }>;
  action: "start" | "move" | "end";
}

export interface SystemMessage {
  type: "system";
  content: string;
}

export type WSMessage =
  | ChatMessage
  | CadUpdateMessage
  | DrawingMessage
  | SystemMessage;
