import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useModelStore } from "../store/useModelStore";

interface CadEdgesProps {
  clippingPlanes: THREE.Plane[];
}

export default function CadEdges({ clippingPlanes }: CadEdgesProps) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const meshData = useModelStore((s) => s.meshData);
  const wireframeVisible = useModelStore((s) => s.wireframeVisible);

  const geometry = useMemo(() => {
    if (!meshData || !meshData.edges.length) return null;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(meshData.edges);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [meshData]);

  useEffect(() => {
    if (matRef.current) {
      matRef.current.clippingPlanes = clippingPlanes;
      matRef.current.needsUpdate = true;
    }
  }, [clippingPlanes]);

  if (!geometry || !wireframeVisible) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={matRef}
        color={0x333333}
        linewidth={1}
      />
    </lineSegments>
  );
}
