import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";

export function CadViewer() {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4488ff" />
      </mesh>
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellColor="#444444"
        sectionSize={5}
        sectionColor="#888888"
        fadeDistance={20}
        infiniteGrid
      />
      <OrbitControls makeDefault />
    </Canvas>
  );
}
