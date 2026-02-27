// --- WebSocket message types ---

export interface ChatMessage {
  type: "chat";
  role: "user" | "assistant";
  content: string;
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

// --- CAD model types ---

export interface MeshData {
  vertices: number[];
  normals: number[];
  triangles: number[];
  face_ids: number[];
  num_faces: number;
  edges: number[];
}

export interface FaceMetadata {
  id: number;
  surface_type: string;
  area: number;
  centroid: number[];
  normal: number[];
  bounds: number[];
  radius: number | null;
  axis_direction: number[] | null;
  axis_point: number[] | null;
  arc_angle: number | null;
  step_name: string | null;
}

export interface ModelInfo {
  num_faces: number;
  num_step_entities: number;
  length_unit: string;
  length_scale: number;
}

export interface UploadResponse {
  success: boolean;
  info: ModelInfo | null;
  mesh: MeshData | null;
  faces: FaceMetadata[] | null;
  filename: string | null;
  error: string | null;
}

export interface FeatureMember {
  face_id: number;
  sub_name: string | null;
}

export interface Feature {
  color: number[];
  faces: FeatureMember[];
}
