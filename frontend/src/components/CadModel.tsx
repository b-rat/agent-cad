import { useRef, useCallback, useEffect, useMemo } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useModelStore } from "../store/useModelStore";

const BASE_COLOR: [number, number, number] = [0.6, 0.6, 0.65];
const HOVER_COLOR: [number, number, number] = [0.5, 0.65, 0.8];
const SELECT_COLOR: [number, number, number] = [0.3, 0.6, 1.0];

interface CadModelProps {
  clippingPlanes: THREE.Plane[];
}

export default function CadModel({ clippingPlanes }: CadModelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhongMaterial>(null);
  const colorsRef = useRef<Float32Array | null>(null);

  const meshData = useModelStore((s) => s.meshData);
  const selectedFaces = useModelStore((s) => s.selectedFaces);
  const hoveredFace = useModelStore((s) => s.hoveredFace);
  const features = useModelStore((s) => s.features);
  const faceToFeature = useModelStore((s) => s.faceToFeature);
  const colorsVisible = useModelStore((s) => s.colorsVisible);
  const xrayMode = useModelStore((s) => s.xrayMode);
  const selectFace = useModelStore((s) => s.selectFace);
  const setHoveredFace = useModelStore((s) => s.setHoveredFace);

  // Build geometry from meshData
  const geometry = useMemo(() => {
    if (!meshData) return null;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(meshData.vertices);
    const normals = new Float32Array(meshData.normals);
    const indices = new Uint32Array(meshData.triangles);

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    const numVertices = positions.length / 3;
    const colors = new Float32Array(numVertices * 3);
    colors.fill(0.6);
    colorsRef.current = colors;
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    return geo;
  }, [meshData]);

  // Apply a color to all vertices of a triangle
  const setTriColor = (
    colors: Float32Array,
    indices: number[],
    triIdx: number,
    color: [number, number, number]
  ) => {
    const i0 = indices[triIdx * 3]!;
    const i1 = indices[triIdx * 3 + 1]!;
    const i2 = indices[triIdx * 3 + 2]!;
    for (const vi of [i0, i1, i2]) {
      colors[vi * 3] = color[0];
      colors[vi * 3 + 1] = color[1];
      colors[vi * 3 + 2] = color[2];
    }
  };

  // Rebuild vertex colors when selection/hover/features change
  const rebuildColors = useCallback(() => {
    if (!meshData || !geometry || !colorsRef.current) return;

    const colors = colorsRef.current;
    const { face_ids, triangles } = meshData;

    // Reset all to base
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = BASE_COLOR[0];
      colors[i + 1] = BASE_COLOR[1];
      colors[i + 2] = BASE_COLOR[2];
    }

    // Apply feature colors
    if (colorsVisible) {
      for (let triIdx = 0; triIdx < face_ids.length; triIdx++) {
        const faceId = face_ids[triIdx]!;
        const featureName = faceToFeature[faceId];
        if (featureName && features[featureName]) {
          const fc = features[featureName].color as [number, number, number];
          setTriColor(colors, triangles, triIdx, fc);
        }
      }
    }

    // Apply hover
    if (hoveredFace >= 0 && !selectedFaces.has(hoveredFace)) {
      for (let triIdx = 0; triIdx < face_ids.length; triIdx++) {
        if (face_ids[triIdx] === hoveredFace) {
          setTriColor(colors, triangles, triIdx, HOVER_COLOR);
        }
      }
    }

    // Apply selection
    for (const selId of selectedFaces) {
      for (let triIdx = 0; triIdx < face_ids.length; triIdx++) {
        if (face_ids[triIdx] === selId) {
          setTriColor(colors, triangles, triIdx, SELECT_COLOR);
        }
      }
    }

    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
    colorAttr.needsUpdate = true;
  }, [meshData, geometry, selectedFaces, hoveredFace, features, faceToFeature, colorsVisible]);

  useEffect(() => {
    rebuildColors();
  }, [rebuildColors]);

  // Update material clipping planes
  useEffect(() => {
    if (matRef.current) {
      matRef.current.clippingPlanes = clippingPlanes;
      matRef.current.needsUpdate = true;
    }
  }, [clippingPlanes]);

  // Update xray
  useEffect(() => {
    if (matRef.current) {
      matRef.current.transparent = xrayMode;
      matRef.current.opacity = xrayMode ? 0.3 : 1.0;
      matRef.current.depthWrite = !xrayMode;
      matRef.current.needsUpdate = true;
    }
  }, [xrayMode]);

  const getFaceAtIntersection = useCallback(
    (faceIndex: number): number => {
      if (!meshData) return -1;
      if (faceIndex >= 0 && faceIndex < meshData.face_ids.length) {
        return meshData.face_ids[faceIndex]!;
      }
      return -1;
    },
    [meshData]
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.faceIndex != null) {
        const faceId = getFaceAtIntersection(e.faceIndex);
        setHoveredFace(faceId);
      }
    },
    [getFaceAtIntersection, setHoveredFace]
  );

  const handlePointerOut = useCallback(() => {
    setHoveredFace(-1);
  }, [setHoveredFace]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.faceIndex != null) {
        const faceId = getFaceAtIntersection(e.faceIndex);
        if (faceId >= 0) {
          const shift = e.nativeEvent.shiftKey;
          selectFace(faceId, shift);
        }
      }
    },
    [getFaceAtIntersection, selectFace]
  );

  if (!geometry) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <meshPhongMaterial
        ref={matRef}
        vertexColors
        side={THREE.DoubleSide}
        shininess={30}
      />
    </mesh>
  );
}
