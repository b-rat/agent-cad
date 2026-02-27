import { create } from "zustand";
import type { MeshData, FaceMetadata, ModelInfo, Feature, FeatureMember } from "../types";

const FEATURE_COLORS: number[][] = [
  [0.9, 0.3, 0.3], // Red
  [0.3, 0.8, 0.3], // Green
  [0.3, 0.5, 0.9], // Blue
  [0.9, 0.8, 0.2], // Yellow
  [0.7, 0.3, 0.8], // Purple
  [0.2, 0.8, 0.8], // Cyan
  [0.9, 0.5, 0.2], // Orange
  [0.5, 0.9, 0.3], // Lime
  [0.9, 0.4, 0.7], // Pink
  [0.4, 0.7, 0.9], // Light Blue
];

export type GridPlane = "XZ" | "XY" | "YZ" | null;
export type ClipPlane = "XY" | "YZ" | "XZ" | null;

interface ModelState {
  // Model data
  isLoaded: boolean;
  filename: string | null;
  meshData: MeshData | null;
  facesMetadata: FaceMetadata[];
  modelInfo: ModelInfo | null;

  // Selection
  selectedFaces: Set<number>;
  hoveredFace: number;
  multiSelectMode: boolean;

  // Features
  features: Record<string, Feature>;
  faceToFeature: Record<number, string>;

  // Display
  xrayMode: boolean;
  wireframeVisible: boolean;
  colorsVisible: boolean;
  gridPlane: GridPlane;
  clipPlane: ClipPlane;
  clipOffset: number;
  clipFlipped: boolean;

  // Actions
  loadModel: (
    meshData: MeshData,
    faces: FaceMetadata[],
    info: ModelInfo,
    filename: string
  ) => void;
  clearModel: () => void;
  selectFace: (faceId: number, shift: boolean) => void;
  clearSelection: () => void;
  setHoveredFace: (faceId: number) => void;
  toggleMultiSelect: () => void;
  createFeature: (name: string) => { success: boolean; error?: string };
  deleteFeature: (name: string) => void;
  setXray: (on: boolean) => void;
  setWireframe: (on: boolean) => void;
  setColors: (on: boolean) => void;
  setGridPlane: (plane: GridPlane) => void;
  setClipPlane: (plane: ClipPlane) => void;
  setClipOffset: (offset: number) => void;
  flipClip: () => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  // Model data
  isLoaded: false,
  filename: null,
  meshData: null,
  facesMetadata: [],
  modelInfo: null,

  // Selection
  selectedFaces: new Set(),
  hoveredFace: -1,
  multiSelectMode: false,

  // Features
  features: {},
  faceToFeature: {},

  // Display
  xrayMode: false,
  wireframeVisible: true,
  colorsVisible: true,
  gridPlane: "XZ",
  clipPlane: null,
  clipOffset: 0,
  clipFlipped: false,

  // Actions
  loadModel: (meshData, faces, info, filename) => {
    // Import features from existing STEP names
    const features: Record<string, Feature> = {};
    const faceToFeature: Record<number, string> = {};
    const featureGroups: Record<string, { face_id: number; sub_name: string | null }[]> = {};

    for (const face of faces) {
      if (face.step_name) {
        const parts = face.step_name.split(".");
        const featureName = parts[0]!;
        const subName = parts.length > 1 ? parts.slice(1).join(".") : null;
        if (!featureGroups[featureName]) featureGroups[featureName] = [];
        featureGroups[featureName]!.push({ face_id: face.id, sub_name: subName });
      }
    }

    let colorIdx = 0;
    for (const [name, members] of Object.entries(featureGroups)) {
      const color = FEATURE_COLORS[colorIdx % FEATURE_COLORS.length]!;
      features[name] = { color, faces: members };
      for (const m of members) {
        faceToFeature[m.face_id] = name;
      }
      colorIdx++;
    }

    set({
      isLoaded: true,
      filename,
      meshData,
      facesMetadata: faces,
      modelInfo: info,
      selectedFaces: new Set(),
      hoveredFace: -1,
      features,
      faceToFeature,
      clipPlane: null,
      clipOffset: 0,
      clipFlipped: false,
    });
  },

  clearModel: () =>
    set({
      isLoaded: false,
      filename: null,
      meshData: null,
      facesMetadata: [],
      modelInfo: null,
      selectedFaces: new Set(),
      hoveredFace: -1,
      features: {},
      faceToFeature: {},
    }),

  selectFace: (faceId, shift) => {
    const { selectedFaces, multiSelectMode } = get();
    const newSet = new Set(selectedFaces);

    if (shift || multiSelectMode) {
      if (newSet.has(faceId)) {
        newSet.delete(faceId);
      } else {
        newSet.add(faceId);
      }
    } else {
      if (newSet.size === 1 && newSet.has(faceId)) {
        newSet.clear();
      } else {
        newSet.clear();
        newSet.add(faceId);
      }
    }
    set({ selectedFaces: newSet });
  },

  clearSelection: () => set({ selectedFaces: new Set() }),

  setHoveredFace: (faceId) => set({ hoveredFace: faceId }),

  toggleMultiSelect: () => set((s) => ({ multiSelectMode: !s.multiSelectMode })),

  createFeature: (name) => {
    const { selectedFaces, features, faceToFeature, facesMetadata } = get();
    if (selectedFaces.size === 0) return { success: false, error: "No faces selected" };
    if (features[name]) return { success: false, error: "Name already exists" };

    // Check if any selected face already belongs to a feature
    for (const fid of selectedFaces) {
      if (faceToFeature[fid]) {
        return {
          success: false,
          error: `Face ${fid} already assigned to "${faceToFeature[fid]}"`,
        };
      }
    }

    // Auto-generate sub-names from surface type
    const faceIds = Array.from(selectedFaces).sort((a, b) => a - b);
    const members: FeatureMember[] = [];

    if (faceIds.length === 1) {
      members.push({ face_id: faceIds[0]!, sub_name: null });
    } else {
      // Count surface types
      const typeCounts: Record<string, number> = {};
      for (const fid of faceIds) {
        const meta = facesMetadata.find((f) => f.id === fid);
        const t = meta?.surface_type ?? "unknown";
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }

      const typeIndex: Record<string, number> = {};
      for (const fid of faceIds) {
        const meta = facesMetadata.find((f) => f.id === fid);
        const t = meta?.surface_type ?? "unknown";
        if (typeCounts[t] === 1) {
          members.push({ face_id: fid, sub_name: t });
        } else {
          typeIndex[t] = (typeIndex[t] || 0) + 1;
          members.push({ face_id: fid, sub_name: `${t}_${typeIndex[t]}` });
        }
      }
    }

    const colorIdx = Object.keys(features).length;
    const color = FEATURE_COLORS[colorIdx % FEATURE_COLORS.length]!;

    const newFeatures: Record<string, Feature> = { ...features, [name]: { color, faces: members } };
    const newFaceToFeature = { ...faceToFeature };
    for (const m of members) {
      newFaceToFeature[m.face_id] = name;
    }

    set({
      features: newFeatures,
      faceToFeature: newFaceToFeature,
      selectedFaces: new Set(),
    });
    return { success: true };
  },

  deleteFeature: (name) => {
    const { features, faceToFeature } = get();
    const feature = features[name];
    if (!feature) return;

    const newFaceToFeature = { ...faceToFeature };
    for (const m of feature.faces) {
      delete newFaceToFeature[m.face_id];
    }

    const newFeatures = { ...features };
    delete newFeatures[name];

    set({ features: newFeatures, faceToFeature: newFaceToFeature });
  },

  setXray: (on) => set({ xrayMode: on }),
  setWireframe: (on) => set({ wireframeVisible: on }),
  setColors: (on) => set({ colorsVisible: on }),
  setGridPlane: (plane) =>
    set((s) => ({ gridPlane: s.gridPlane === plane ? null : plane })),
  setClipPlane: (plane) =>
    set((s) => ({
      clipPlane: s.clipPlane === plane ? null : plane,
      clipOffset: 0,
      clipFlipped: false,
    })),
  setClipOffset: (offset) => set({ clipOffset: offset }),
  flipClip: () => set((s) => ({ clipFlipped: !s.clipFlipped })),
}));
