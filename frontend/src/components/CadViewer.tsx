import { useMemo, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CadModel from "./CadModel";
import CadEdges from "./CadEdges";
import Toolbar from "./Toolbar";
import { useModelStore } from "../store/useModelStore";

function GridHelper() {
  const gridPlane = useModelStore((s) => s.gridPlane);

  if (!gridPlane) return null;

  // Grid rotation based on plane
  const rotation: [number, number, number] =
    gridPlane === "XZ"
      ? [0, 0, 0]
      : gridPlane === "XY"
        ? [Math.PI / 2, 0, 0]
        : [0, 0, Math.PI / 2];

  return (
    <Grid
      args={[20, 20]}
      cellSize={1}
      cellColor="#444444"
      sectionSize={5}
      sectionColor="#888888"
      fadeDistance={30}
      infiniteGrid
      rotation={rotation}
    />
  );
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight
        args={[0xffffff, 0x444444, 0.4]}
      />
      <directionalLight position={[5, 8, 5]} intensity={0.4} />
      <directionalLight position={[-5, -3, -5]} intensity={0.2} />
    </>
  );
}

export function CadViewer() {
  const isLoaded = useModelStore((s) => s.isLoaded);
  const clipPlane = useModelStore((s) => s.clipPlane);
  const clipOffset = useModelStore((s) => s.clipOffset);
  const clipFlipped = useModelStore((s) => s.clipFlipped);

  // Compute clipping planes
  const clippingPlanes = useMemo(() => {
    if (!clipPlane) return [];

    let normal: THREE.Vector3;
    if (clipPlane === "XY") normal = new THREE.Vector3(0, 0, 1);
    else if (clipPlane === "YZ") normal = new THREE.Vector3(1, 0, 0);
    else normal = new THREE.Vector3(0, 1, 0); // XZ

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
        gl={{ localClippingEnabled: true }}
        onPointerMissed={handlePointerMissed}
      >
        <SceneLighting />
        {isLoaded && (
          <>
            <CadModel clippingPlanes={clippingPlanes} />
            <CadEdges clippingPlanes={clippingPlanes} />
          </>
        )}
        <GridHelper />
        <OrbitControls makeDefault />
      </Canvas>
      <Toolbar />
    </div>
  );
}
