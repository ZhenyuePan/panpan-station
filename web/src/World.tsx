import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Float,
  Html,
  OrbitControls,
  RoundedBox,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import type { Section } from "./types";

const C = {
  wood: "#b67c62",
  edge: "#644665",
  wall: "#79728e",
  floor: "#cfac98",
  orange: "#ffaf66",
  cyan: "#8ee5c5",
  dark: "#2a293d",
};
type V3 = [number, number, number];
function Box({
  p,
  s,
  color,
  glow = 0,
  rotation,
  round = false,
}: {
  p: V3;
  s: V3;
  color: string;
  glow?: number;
  rotation?: V3;
  round?: boolean;
}) {
  const mat = (
    <meshStandardMaterial
      color={color}
      roughness={0.68}
      emissive={glow ? color : "#000000"}
      emissiveIntensity={glow}
    />
  );
  return round ? (
    <RoundedBox
      position={p}
      args={s}
      radius={0.07}
      smoothness={2}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      {mat}
    </RoundedBox>
  ) : (
    <mesh position={p} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={s} />
      {mat}
    </mesh>
  );
}
function Cylinder({
  p,
  r,
  h,
  color,
  top,
}: {
  p: V3;
  r: number;
  h: number;
  color: string;
  top?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[top ?? r, r, h, 24]} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  );
}
function Screen({
  p,
  size = [1.25, 0.86, 0.1],
  color = C.cyan,
}: {
  p: V3;
  size?: V3;
  color?: string;
}) {
  return (
    <group position={p}>
      <Box p={[0, 0, 0]} s={size} color={C.dark} round />
      <Box
        p={[0, 0.01, 0.061]}
        s={[size[0] - 0.11, size[1] - 0.12, 0.018]}
        color="#192f39"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          p={[-0.12 + (i % 2) * 0.07, 0.24 - i * 0.115, 0.076]}
          s={[size[0] * (0.32 + (i % 3) * 0.09), 0.023, 0.008]}
          color={i % 3 === 0 ? C.orange : color}
          glow={1.1}
        />
      ))}
    </group>
  );
}
function Robot({
  active,
  onClick,
  reduced,
}: {
  active: boolean;
  onClick: () => void;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (reduced) return;
    if (group.current)
      group.current.rotation.y =
        Math.sin(clock.elapsedTime * 0.65) * 0.15 - 0.3;
    if (eyes.current)
      eyes.current.scale.y =
        Math.sin(clock.elapsedTime * 1.1) > 0.995 ? 0.12 : 1;
  });
  return (
    <Float
      speed={reduced ? 0 : 2}
      rotationIntensity={reduced ? 0 : 0.12}
      floatIntensity={reduced ? 0 : 0.6}
    >
      <group
        position={[2.6, 1.02, 1.65]}
        ref={group}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <Box p={[0, 0, 0]} s={[0.66, 0.73, 0.55]} color="#ede1d6" round />
        <Box p={[0, 0.53, 0]} s={[0.95, 0.73, 0.65]} color="#fff0df" round />
        <Box
          p={[0, 0.53, 0.335]}
          s={[0.74, 0.42, 0.04]}
          color="#223441"
          round
        />
        <group ref={eyes} position={[0, 0.54, 0.369]}>
          <Box
            p={[-0.18, 0, 0]}
            s={[0.095, 0.17, 0.02]}
            color={C.cyan}
            glow={2}
            round
          />
          <Box
            p={[0.18, 0, 0]}
            s={[0.095, 0.17, 0.02]}
            color={C.cyan}
            glow={2}
            round
          />
        </group>
        <Box
          p={[-0.52, 0.52, 0]}
          s={[0.14, 0.36, 0.43]}
          color={C.orange}
          round
        />
        <Box
          p={[0.52, 0.52, 0]}
          s={[0.14, 0.36, 0.43]}
          color={C.orange}
          round
        />
        <Cylinder p={[0, 1, 0]} h={0.24} r={0.025} color={C.dark} />
        <mesh position={[0, 1.16, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color={C.orange}
            emissive={C.orange}
            emissiveIntensity={active ? 3 : 0.6}
          />
        </mesh>
        <Box
          p={[-0.44, -0.02, 0]}
          s={[0.17, 0.43, 0.22]}
          color="#e9c09d"
          rotation={[0, 0, -0.3]}
          round
        />
        <Box
          p={[0.44, 0.07, 0]}
          s={[0.17, 0.43, 0.22]}
          color="#e9c09d"
          rotation={[0, 0, -0.7]}
          round
        />
        <Box
          p={[0, -0.02, 0.291]}
          s={[0.18, 0.12, 0.02]}
          color={C.orange}
          glow={0.7}
        />
        <mesh position={[0, -0.61, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.27, 0.36, 32]} />
          <meshBasicMaterial
            color={C.cyan}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </Float>
  );
}
function Plant({ p, scale = 1 }: { p: V3; scale?: number }) {
  return (
    <group position={p} scale={scale}>
      <Cylinder p={[0, 0.23, 0]} r={0.25} top={0.32} h={0.46} color="#e1a77e" />
      <Cylinder p={[0, 0.47, 0]} r={0.27} h={0.025} color="#51454b" />
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, i * 1.3, 0]}>
          <mesh
            position={[0.1, 0.78 + (i % 2) * 0.19, 0]}
            rotation={[0, 0, -0.5 - (i % 2) * 0.35]}
            scale={[0.15, 0.46, 0.075]}
            castShadow
          >
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color={i % 2 ? "#639980" : "#9db68a"} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function Hotspot({
  p,
  number,
  label,
  color,
  onClick,
}: {
  p: V3;
  number?: string;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <Html position={p} center zIndexRange={[8, 1]}>
      <button
        className="world-label chat-hotspot"
        onClick={onClick}
        style={{ "--hotspot": color || "#ffd1a1" } as React.CSSProperties}
      >
        {number && <span>{number}</span>}
        {label}
      </button>
    </Html>
  );
}
function Beacon({
  p,
  color = "#ffd28b",
  reduced = false,
}: {
  p: V3;
  color?: string;
  reduced?: boolean;
}) {
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!halo.current || reduced) return;
    const scale = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.16;
    halo.current.scale.set(scale, scale, scale);
  });
  return (
    <group position={p}>
      <pointLight
        color={color}
        intensity={reduced ? 0.35 : 0.9}
        distance={1.15}
      />
      <mesh>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.8}
        />
      </mesh>
      <mesh ref={halo} position={[0, 0, 0.008]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.13, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.72}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Html center zIndexRange={[7, 0]}>
        <span
          className="object-beacon"
          style={{ "--beacon": color } as React.CSSProperties}
        />
      </Html>
    </group>
  );
}
function Room({
  navigate,
  chat,
  chatting,
  reduced,
}: {
  navigate: (s: Section) => void;
  chat: () => void;
  chatting: boolean;
  reduced: boolean;
}) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.zoom = Math.min(size.width / 12.7, size.height / 9.2, 76);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return (
    <>
      <ambientLight intensity={1.25} />
      <hemisphereLight args={["#dbd2ff", "#423346", 2.1]} />
      <directionalLight
        position={[3, 9, 6]}
        intensity={3.2}
        color="#ffe2be"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-normalBias={0.04}
      />
      <pointLight
        position={[-3, 3, 1]}
        intensity={9}
        color="#bd9cfa"
        distance={9}
      />
      <pointLight
        position={[1, 2, -1]}
        intensity={8}
        color="#ffb878"
        distance={5}
      />
      <group position={[0, -0.4, 0]}>
        <Box p={[0, -0.23, 0]} s={[8.9, 0.6, 6.8]} color={C.edge} round />
        <Box p={[0, 0.1, 0]} s={[8.6, 0.14, 6.5]} color={C.floor} round />
        {Array.from({ length: 16 }, (_, i) => (
          <Box
            key={i}
            p={[-4 + i * 0.52, 0.177, 0]}
            s={[0.012, 0.005, 6.25]}
            color="#b29388"
          />
        ))}
        <Box p={[0, 1.93, -3.12]} s={[8.6, 3.55, 0.22]} color={C.wall} round />
        <Box
          p={[-4.16, 1.93, -0.3]}
          s={[0.23, 3.55, 5.75]}
          color="#82788f"
          round
        />
        <Box p={[0, 3.71, -3.12]} s={[8.7, 0.09, 0.25]} color="#b9a3bd" />
        <Box p={[-4.16, 3.71, -0.3]} s={[0.26, 0.09, 5.8]} color="#b9a3bd" />
        <Box
          p={[0, 0.32, -2.94]}
          s={[8.3, 0.065, 0.04]}
          color={C.orange}
          glow={1.4}
        />
        <Box
          p={[-4.02, 0.32, -0.25]}
          s={[0.045, 0.065, 5.4]}
          color={C.orange}
          glow={1.4}
        />
        <mesh
          position={[0.25, 0.19, 1.1]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <circleGeometry args={[1.85, 64]} />
          <meshStandardMaterial color="#b49bbb" roughness={1} />
        </mesh>
        <mesh position={[0.25, 0.195, 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.55, 1.58, 64]} />
          <meshStandardMaterial color="#d0b6c7" />
        </mesh>
        {/* A real, constructed bookshelf: warm wood, books and an illuminated edge. */}
        <group
          position={[-2.8, 0, -1.94]}
          onClick={(e) => {
            e.stopPropagation();
            navigate("blog");
          }}
          onPointerOver={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <Box p={[0, 1.38, 0]} s={[1.72, 2.43, 0.52]} color="#685265" round />
          <Box p={[0, 1.38, 0.29]} s={[1.55, 2.2, 0.04]} color="#493d51" />
          {[0.4, 1.08, 1.78, 2.49].map((y) => (
            <Box
              key={y}
              p={[0, y, 0.3]}
              s={[1.77, 0.09, 0.65]}
              color="#c99576"
            />
          ))}
          {Array.from({ length: 17 }, (_, i) => {
            const row = Math.floor(i / 6);
            return (
              <Box
                key={i}
                p={[-0.65 + (i % 6) * 0.23, 0.67 + row * 0.7, 0.36]}
                s={[0.16, 0.4 + (i % 3) * 0.05, 0.37]}
                color={
                  ["#edb57f", "#b4c1a0", "#b3a0c5", "#a16e77", "#eadbc1"][i % 5]
                }
                rotation={[0, 0, i === 5 ? -0.16 : 0]}
              />
            );
          })}
          <Plant p={[0.4, 2.54, 0]} scale={0.48} />
          <Beacon p={[0.56, 1.74, 0.68]} reduced={reduced} />
        </group>
        {/* Desk, dual monitors, keyboard and a small mug. */}
        <group
          position={[0.15, 0, -1.48]}
          onClick={(e) => {
            e.stopPropagation();
            navigate("projects");
          }}
          onPointerOver={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <Box
            p={[0.15, 1.16, 0]}
            s={[3.55, 0.16, 1.22]}
            color="#d49f78"
            round
          />
          {[-1.35, 1.62].map((x) => (
            <Box
              key={x}
              p={[x, 0.65, 0]}
              s={[0.12, 1.05, 0.85]}
              color="#433b51"
            />
          ))}
          <Screen p={[-0.53, 1.95, -0.27]} />
          <Screen
            p={[0.85, 1.95, -0.23]}
            size={[1.2, 0.86, 0.1]}
            color="#d2a1ee"
          />
          {[-0.53, 0.85].map((x) => (
            <group key={x}>
              <Box p={[x, 1.47, -0.29]} s={[0.08, 0.38, 0.08]} color={C.dark} />
              <Box p={[x, 1.26, -0.2]} s={[0.47, 0.05, 0.26]} color={C.dark} />
            </group>
          ))}
          <Box
            p={[0.05, 1.27, 0.32]}
            s={[1.35, 0.04, 0.32]}
            color="#7b7185"
            round
          />
          {Array.from({ length: 12 }, (_, i) => (
            <Box
              key={i}
              p={[
                -0.5 + (i % 6) * 0.21,
                1.298,
                0.23 + Math.floor(i / 6) * 0.14,
              ]}
              s={[0.14, 0.008, 0.075]}
              color="#d6c7cf"
            />
          ))}
          <Cylinder p={[1.31, 1.4, 0.24]} r={0.13} h={0.28} color={C.orange} />
          <Cylinder p={[1.31, 1.55, 0.24]} r={0.1} h={0.012} color="#4b3e3b" />
          <Beacon p={[1.31, 1.61, 0.4]} color="#bce9cd" reduced={reduced} />
        </group>
        {/* Chair. */}
        <group position={[0.23, 0, 0.03]} rotation={[0, -0.32, 0]}>
          <Box p={[0, 0.74, 0]} s={[0.87, 0.2, 0.86]} color="#7b668b" round />
          <Box
            p={[0, 1.21, 0.31]}
            s={[0.87, 0.89, 0.17]}
            color="#8e789b"
            rotation={[-0.08, 0, 0]}
            round
          />
          <Cylinder p={[0, 0.4, 0]} r={0.06} h={0.6} color={C.dark} />
          {[0, 1, 2, 3, 4].map((i) => (
            <group key={i} rotation={[0, (i * Math.PI) / 2.5, 0]}>
              <Box p={[0.23, 0.2, 0]} s={[0.58, 0.06, 0.06]} color={C.dark} />
            </group>
          ))}
        </group>
        {/* Community pinboard. */}
        <group
          position={[2.95, 2.12, -2.94]}
          onClick={(e) => {
            e.stopPropagation();
            navigate("forum");
          }}
          onPointerOver={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <Box p={[0, 0, 0]} s={[1.76, 1.63, 0.13]} color="#bc8866" round />
          <Box p={[0, 0, 0.078]} s={[1.56, 1.44, 0.025]} color="#947471" />
          {[
            [-0.37, 0.29],
            [0.34, 0.22],
            [-0.3, -0.4],
            [0.37, -0.35],
          ].map(([x, y], i) => (
            <group
              key={i}
              position={[x, y, 0.115]}
              rotation={[0, 0, (i % 2 ? 1 : -1) * 0.12]}
            >
              <Box
                p={[0, 0, 0]}
                s={[0.52, 0.49, 0.013]}
                color={["#efd3a0", "#bdd7ba", "#d8b6de", "#eab68f"][i]}
              />
              <mesh position={[0, 0.18, 0.03]}>
                <sphereGeometry args={[0.035, 8, 8]} />
                <meshStandardMaterial color="#e16e66" />
              </mesh>
              {[0, 1, 2].map((j) => (
                <Box
                  key={j}
                  p={[-0.03, 0.04 - j * 0.09, 0.012]}
                  s={[0.29 - j * 0.05, 0.017, 0.005]}
                  color="#947e84"
                />
              ))}
            </group>
          ))}
          <Beacon p={[0.5, 0.35, 0.18]} color="#ffcf8b" reduced={reduced} />
        </group>
        {/* Circular night-sky window. */}
        <mesh position={[-0.33, 2.92, -2.978]}>
          <circleGeometry args={[0.51, 48]} />
          <meshStandardMaterial
            color="#39375a"
            emissive="#555195"
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh position={[-0.33, 2.92, -2.955]}>
          <torusGeometry args={[0.54, 0.055, 12, 64]} />
          <meshStandardMaterial color="#e0c5a8" />
        </mesh>
        <mesh position={[-0.18, 3.04, -2.92]}>
          <sphereGeometry args={[0.17, 24, 24]} />
          <meshStandardMaterial
            color="#efc68e"
            emissive="#efc68e"
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* Server rack and desk lamp. */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            navigate("dashboard");
          }}
          onPointerOver={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <Box
            p={[3.22, 0.74, -0.95]}
            s={[0.83, 1.12, 0.95]}
            color="#454151"
            round
          />
          {[0, 1, 2].map((i) => (
            <group key={i}>
              <Box
                p={[3.22, 1.07 - i * 0.29, -0.465]}
                s={[0.64, 0.17, 0.022]}
                color="#252836"
              />
              <Box
                p={[3.42, 1.07 - i * 0.29, -0.448]}
                s={[0.05, 0.04, 0.012]}
                color={C.cyan}
                glow={2}
              />
            </group>
          ))}
          <Beacon p={[3.43, 1.1, -0.43]} color="#aee6ff" reduced={reduced} />
        </group>
        <Cylinder p={[1.85, 1.37, -1.8]} r={0.15} h={0.06} color={C.dark} />
        <Cylinder p={[1.85, 1.82, -1.8]} r={0.025} h={0.9} color={C.dark} />
        <mesh position={[1.85, 2.29, -1.8]}>
          <coneGeometry args={[0.27, 0.24, 24, 1, true]} />
          <meshStandardMaterial
            color={C.orange}
            side={THREE.DoubleSide}
            emissive={C.orange}
            emissiveIntensity={0.25}
          />
        </mesh>
        {/* Personal corner: plant, a floor cushion and a tiny cat. */}
        <Plant p={[-3.24, 0.2, 1.87]} scale={1.35} />
        <Box p={[-2.22, 0.4, 1.9]} s={[1.08, 0.4, 0.9]} color="#deae7f" round />
        <group position={[-2.18, 0.75, 1.9]}>
          <mesh scale={[0.37, 0.2, 0.23]} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color="#f0d5bc" />
          </mesh>
          <mesh position={[0.23, 0.1, 0.1]} castShadow>
            <sphereGeometry args={[0.19, 12, 12]} />
            <meshStandardMaterial color="#f0d5bc" />
          </mesh>
          {[0.12, 0.33].map((x) => (
            <mesh key={x} position={[x, 0.28, 0.1]}>
              <coneGeometry args={[0.075, 0.16, 4]} />
              <meshStandardMaterial color="#e5b99a" />
            </mesh>
          ))}
        </group>
        <Robot active={chatting} onClick={chat} reduced={reduced} />
        <Hotspot
          p={[2.6, 2.25, 1.72]}
          label="和潘潘聊聊"
          color="#bce9cd"
          onClick={chat}
        />
      </group>
      <Float speed={reduced ? 0 : 0.8} floatIntensity={0.25}>
        <group position={[-5.5, 3.4, -3]} rotation={[0.45, 0, -0.35]}>
          <mesh>
            <sphereGeometry args={[0.48, 32, 24]} />
            <meshStandardMaterial color="#d3b19e" roughness={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.8, 0.025, 8, 64]} />
            <meshStandardMaterial color="#b39ad0" />
          </mesh>
        </group>
      </Float>
      <ContactShadows
        position={[0, -1.25, 0]}
        opacity={0.4}
        scale={20}
        blur={3}
        far={5}
        resolution={256}
        color="#000000"
      />
      <OrbitControls
        makeDefault
        target={[0, 1.18, -0.25]}
        enablePan={false}
        enableZoom
        minZoom={48}
        maxZoom={115}
        minPolarAngle={0.7}
        maxPolarAngle={1.3}
        minAzimuthAngle={-0.6}
        maxAzimuthAngle={1.3}
      />
    </>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function World(props: {
  navigate: (s: Section) => void;
  chat: () => void;
  chatting: boolean;
  reduced: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const supported = useMemo(() => {
    try {
      const c = document.createElement("canvas");
      const g = c.getContext("webgl2");
      if (!g) return false;
      g.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  }, []);
  const fallback = (
    <div className="scene-fallback">
      <span>✦</span>
      <h2>欢迎来到潘潘的工作室</h2>
      <p>当前设备使用轻量浏览模式，所有内容仍然可以访问。</p>
      <button className="primary" onClick={() => props.navigate("blog")}>
        打开灵感书架 ↗
      </button>
    </div>
  );
  return (
    <div className={"scene-wrap " + (loaded ? "scene-loaded" : "")}>
      <SceneBoundary fallback={fallback}>
        {supported ? (
          <Suspense
            fallback={
              <div className="scene-loading">
                正在点亮工作室 <span>···</span>
              </div>
            }
          >
            <Canvas
              shadows
              orthographic
              camera={{ position: [6.4, 7.6, 15.2], zoom: 65 }}
              dpr={[1, 1.6]}
              gl={{ antialias: true, alpha: true }}
              onCreated={({ gl }) => {
                gl.setClearColor("#000000", 0);
                setLoaded(true);
              }}
            >
              <Room {...props} />
            </Canvas>
          </Suspense>
        ) : (
          fallback
        )}
      </SceneBoundary>
    </div>
  );
}
