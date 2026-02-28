import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const AXIS_LENGTH = 2;
const CONE_HEIGHT = 0.15;
const CONE_RADIUS = 0.05;

const axes = [
  { dir: [AXIS_LENGTH, 0, 0] as const, color: "#e74c3c", label: "X" },
  { dir: [0, AXIS_LENGTH, 0] as const, color: "#2ecc71", label: "Y" },
  { dir: [0, 0, AXIS_LENGTH] as const, color: "#3498db", label: "Z" },
] as const;

export default function OriginAxes() {
  const lineGeometries = useMemo(
    () =>
      axes.map(({ dir }) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute([0, 0, 0, ...dir], 3)
        );
        return geo;
      }),
    []
  );

  return (
    <group>
      {axes.map(({ dir, color, label }, i) => {
        // Rotation to point the cone along the axis
        const conePos = new THREE.Vector3(...dir);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          conePos.clone().normalize()
        );

        return (
          <group key={label}>
            {/* Axis line */}
            <lineSegments geometry={lineGeometries[i]!}>
              <lineBasicMaterial color={color} />
            </lineSegments>

            {/* Arrowhead cone */}
            <mesh position={conePos} quaternion={quaternion}>
              <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, 12]} />
              <meshBasicMaterial color={color} />
            </mesh>

            {/* Label */}
            <Text
              position={[dir[0] * 1.15, dir[1] * 1.15, dir[2] * 1.15]}
              fontSize={0.18}
              color={color}
              anchorX="center"
              anchorY="middle"
            >
              {label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
