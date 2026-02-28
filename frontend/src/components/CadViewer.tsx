import { useMemo, useCallback, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { TrackballControls } from "@react-three/drei";
import * as THREE from "three";
import CadModel from "./CadModel";
import CadEdges from "./CadEdges";
import OriginAxes from "./OriginAxes";
import Toolbar from "./Toolbar";
import { useModelStore } from "../store/useModelStore";

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={[0xffffff, 0x444444, 0.4]} />
      <directionalLight position={[5, 8, 5]} intensity={0.4} />
      <directionalLight position={[-5, -3, -5]} intensity={0.2} />
    </>
  );
}

function FitCameraHelper() {
  const { camera, controls } = useThree();
  const meshData = useModelStore((s) => s.meshData);
  const fitAllCounter = useModelStore((s) => s.fitAllCounter);
  const lastFit = useRef(0);

  useEffect(() => {
    if (fitAllCounter === lastFit.current) return;
    lastFit.current = fitAllCounter;

    if (!meshData) return;

    // Compute bounding box from vertices
    const positions = meshData.vertices;
    const box = new THREE.Box3();
    for (let i = 0; i < positions.length; i += 3) {
      box.expandByPoint(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = (camera as THREE.PerspectiveCamera).fov;
    const distance = maxDim / (2 * Math.tan((fov * Math.PI) / 360)) * 1.5;

    // Position camera at isometric-ish angle
    const dir = new THREE.Vector3(1, 0.8, 1).normalize();
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    // Update TrackballControls target
    if (controls && "target" in controls) {
      (controls as any).target.copy(center);
      (controls as any).update();
    }
  }, [fitAllCounter, meshData, camera, controls]);

  return null;
}

const VIEW_DIRECTIONS: Record<string, { dir: THREE.Vector3; up: THREE.Vector3 }> = {
  front:     { dir: new THREE.Vector3(0, 0, 1),  up: new THREE.Vector3(0, 1, 0) },
  back:      { dir: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
  right:     { dir: new THREE.Vector3(1, 0, 0),  up: new THREE.Vector3(0, 1, 0) },
  left:      { dir: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
  top:       { dir: new THREE.Vector3(0, 1, 0),  up: new THREE.Vector3(0, 0, -1) },
  bottom:    { dir: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
  isometric: { dir: new THREE.Vector3(1, 0.8, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
};

function ViewHelper() {
  const { camera, controls } = useThree();
  const meshData = useModelStore((s) => s.meshData);
  const viewRequest = useModelStore((s) => s.viewRequest);

  useEffect(() => {
    if (!viewRequest) return;
    if (!meshData) {
      console.warn("[ViewHelper] viewRequest received but no meshData loaded");
      useModelStore.setState({ viewRequest: null });
      return;
    }

    const entry = VIEW_DIRECTIONS[viewRequest.view];
    if (!entry) {
      console.warn("[ViewHelper] unknown view:", viewRequest.view);
      useModelStore.setState({ viewRequest: null });
      return;
    }
    console.log("[ViewHelper] applying view:", viewRequest.view, "zoom:", viewRequest.zoom);

    // Compute bounding box from vertices
    const positions = meshData.vertices;
    const box = new THREE.Box3();
    for (let i = 0; i < positions.length; i += 3) {
      box.expandByPoint(new THREE.Vector3(positions[i]!, positions[i + 1]!, positions[i + 2]!));
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = (camera as THREE.PerspectiveCamera).fov;
    const fitDistance = maxDim / (2 * Math.tan((fov * Math.PI) / 360)) * 1.5;
    const distance = fitDistance / viewRequest.zoom;

    // Set camera.up before positioning (critical for top/bottom views)
    camera.up.copy(entry.up);
    camera.position.copy(center).addScaledVector(entry.dir, distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    // Update TrackballControls target and up vector
    if (controls && "target" in controls) {
      (controls as any).target.copy(center);
      // TrackballControls has its own `up` that must match
      if ("up" in (controls as any)) {
        (controls as any).up.copy(entry.up);
      }
      (controls as any).update();
    }

    // Clear the request so it doesn't re-trigger
    useModelStore.setState({ viewRequest: null });
  }, [viewRequest, meshData, camera, controls]);

  return null;
}

export function CadViewer() {
  const isLoaded = useModelStore((s) => s.isLoaded);
  const clipPlane = useModelStore((s) => s.clipPlane);
  const clipOffset = useModelStore((s) => s.clipOffset);
  const clipFlipped = useModelStore((s) => s.clipFlipped);

  const clippingPlanes = useMemo(() => {
    if (!clipPlane) return [];

    let normal: THREE.Vector3;
    if (clipPlane === "XY") normal = new THREE.Vector3(0, 0, 1);
    else if (clipPlane === "YZ") normal = new THREE.Vector3(1, 0, 0);
    else normal = new THREE.Vector3(0, 1, 0);

    if (clipFlipped) normal.negate();
    return [new THREE.Plane(normal, clipOffset)];
  }, [clipPlane, clipOffset, clipFlipped]);

  const handlePointerMissed = useCallback(() => {
    useModelStore.getState().setHoveredFace(-1);
  }, []);

  return (
    <div className="viewer-container" style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        gl={{ localClippingEnabled: true, preserveDrawingBuffer: true }}
        onPointerMissed={handlePointerMissed}
      >
        <SceneLighting />
        <FitCameraHelper />
        <ViewHelper />
        {isLoaded && (
          <>
            <CadModel clippingPlanes={clippingPlanes} />
            <CadEdges clippingPlanes={clippingPlanes} />
          </>
        )}
        <OriginAxes />
        <TrackballControls makeDefault rotateSpeed={3} />
      </Canvas>
      <Toolbar />
    </div>
  );
}
