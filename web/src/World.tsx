import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html, OrbitControls, RoundedBox, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { Section } from './types';

const C = { wood: '#b67c62', edge: '#644665', wall: '#79728e', floor: '#cfac98', orange: '#ffaf66', cyan: '#8ee5c5', dark: '#2a293d' };
type V3 = [number, number, number];
function Box({ p, s, color, glow = 0, rotation, round = false }: { p: V3; s: V3; color: string; glow?: number; rotation?: V3; round?: boolean }) {
  const mat = <meshStandardMaterial color={color} roughness={.68} emissive={glow ? color : '#000000'} emissiveIntensity={glow} />;
  return round ? <RoundedBox position={p} args={s} radius={.07} smoothness={2} rotation={rotation} castShadow receiveShadow>{mat}</RoundedBox> : <mesh position={p} rotation={rotation} castShadow receiveShadow><boxGeometry args={s} />{mat}</mesh>;
}
function Cylinder({ p, r, h, color, top }: { p: V3; r: number; h: number; color: string; top?: number }) {
  return <mesh position={p} castShadow receiveShadow><cylinderGeometry args={[top ?? r, r, h, 24]} /><meshStandardMaterial color={color} roughness={.65} /></mesh>;
}
function Screen({ p, size = [1.25, .86, .1], color = C.cyan }: { p: V3; size?: V3; color?: string }) {
  return <group position={p}><Box p={[0, 0, 0]} s={size} color={C.dark} round /><Box p={[0, .01, .061]} s={[size[0] - .11, size[1] - .12, .018]} color="#192f39" />
    {[0, 1, 2, 3, 4].map(i => <Box key={i} p={[-.12 + (i % 2) * .07, .24 - i * .115, .076]} s={[size[0] * (.32 + (i % 3) * .09), .023, .008]} color={i % 3 === 0 ? C.orange : color} glow={1.1} />)}
  </group>;
}
function Robot({ active, onClick, reduced }: { active: boolean; onClick: () => void; reduced: boolean }) {
  const group = useRef<THREE.Group>(null); const eyes = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (reduced) return; if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * .65) * .15 - .3; if (eyes.current) eyes.current.scale.y = Math.sin(clock.elapsedTime * 1.1) > .995 ? .12 : 1; });
  return <Float speed={reduced ? 0 : 2} rotationIntensity={reduced ? 0 : .12} floatIntensity={reduced ? 0 : .6}><group position={[2.6, 1.02, 1.65]} ref={group} onClick={e => { e.stopPropagation(); onClick(); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
    <Box p={[0, 0, 0]} s={[.66, .73, .55]} color="#ede1d6" round />
    <Box p={[0, .53, 0]} s={[.95, .73, .65]} color="#fff0df" round />
    <Box p={[0, .53, .335]} s={[.74, .42, .04]} color="#223441" round />
    <group ref={eyes} position={[0, .54, .369]}><Box p={[-.18, 0, 0]} s={[.095, .17, .02]} color={C.cyan} glow={2} round /><Box p={[.18, 0, 0]} s={[.095, .17, .02]} color={C.cyan} glow={2} round /></group>
    <Box p={[-.52, .52, 0]} s={[.14, .36, .43]} color={C.orange} round /><Box p={[.52, .52, 0]} s={[.14, .36, .43]} color={C.orange} round />
    <Cylinder p={[0, 1, 0]} h={.24} r={.025} color={C.dark} />
    <mesh position={[0, 1.16, 0]}><sphereGeometry args={[.08, 16, 16]} /><meshStandardMaterial color={C.orange} emissive={C.orange} emissiveIntensity={active ? 3 : .6} /></mesh>
    <Box p={[-.44, -.02, 0]} s={[.17, .43, .22]} color="#e9c09d" rotation={[0, 0, -.3]} round /><Box p={[.44, .07, 0]} s={[.17, .43, .22]} color="#e9c09d" rotation={[0, 0, -.7]} round />
    <Box p={[0, -.02, .291]} s={[.18, .12, .02]} color={C.orange} glow={.7} />
    <mesh position={[0, -.61, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.27, .36, 32]} /><meshBasicMaterial color={C.cyan} transparent opacity={.5} side={THREE.DoubleSide} /></mesh>
    <Beacon p={[.48, 1.1, .3]} color="#bce9cd" reduced={reduced} />
  </group></Float>;
}
function Plant({ p, scale = 1 }: { p: V3; scale?: number }) {
  return <group position={p} scale={scale}><Cylinder p={[0, .23, 0]} r={.25} top={.32} h={.46} color="#e1a77e" /><Cylinder p={[0, .47, 0]} r={.27} h={.025} color="#51454b" />
    {[0, 1, 2, 3, 4].map(i => <group key={i} rotation={[0, i * 1.3, 0]}><mesh position={[.1, .78 + (i % 2) * .19, 0]} rotation={[0, 0, -.5 - (i % 2) * .35]} scale={[.15, .46, .075]} castShadow><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color={i % 2 ? '#639980' : '#9db68a'} /></mesh></group>)}
  </group>;
}
function Hotspot({ p, number, label, color, onClick }: { p: V3; number?: string; label: string; color?: string; onClick: () => void }) {
  return <Html position={p} center zIndexRange={[8, 1]}><button className="world-label" onClick={onClick} style={{ '--hotspot': color || '#ffd1a1' } as React.CSSProperties}>{number && <span>{number}</span>}{label}</button></Html>;
}
function Beacon({ p, color = '#ffd28b', reduced = false }: { p: V3; color?: string; reduced?: boolean }) {
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!halo.current || reduced) return;
    const scale = 1 + Math.sin(clock.elapsedTime * 2.2) * .16;
    halo.current.scale.set(scale, scale, scale);
  });
  return <group position={p}>
    <pointLight color={color} intensity={reduced ? .35 : .9} distance={1.15} />
    <mesh><sphereGeometry args={[.052, 16, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.8} /></mesh>
    <mesh ref={halo} position={[0, 0, .008]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.1, .13, 24]} /><meshBasicMaterial color={color} transparent opacity={.72} side={THREE.DoubleSide} /></mesh>
  </group>;
}
function Room({ navigate, chat, chatting, reduced }: { navigate: (s: Section) => void; chat: () => void; chatting: boolean; reduced: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => { camera.zoom = Math.min(size.width / 12.7, size.height / 9.2, 76); camera.updateProjectionMatrix(); }, [camera, size.width, size.height]);
  return <>
    <ambientLight intensity={1.25} /><hemisphereLight args={['#dbd2ff', '#423346', 2.1]} />
    <directionalLight position={[3, 9, 6]} intensity={3.2} color="#ffe2be" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={.04} />
    <pointLight position={[-3, 3, 1]} intensity={9} color="#bd9cfa" distance={9} /><pointLight position={[1, 2, -1]} intensity={8} color="#ffb878" distance={5} />
    <group position={[0, -.4, 0]}>
      <Box p={[0, -.23, 0]} s={[8.9, .6, 6.8]} color={C.edge} round />
      <Box p={[0, .1, 0]} s={[8.6, .14, 6.5]} color={C.floor} round />
      {Array.from({ length: 16 }, (_, i) => <Box key={i} p={[-4 + i * .52, .177, 0]} s={[.012, .005, 6.25]} color="#b29388" />)}
      <Box p={[0, 1.93, -3.12]} s={[8.6, 3.55, .22]} color={C.wall} round />
      <Box p={[-4.16, 1.93, -.3]} s={[.23, 3.55, 5.75]} color="#82788f" round />
      <Box p={[0, 3.71, -3.12]} s={[8.7, .09, .25]} color="#b9a3bd" /><Box p={[-4.16, 3.71, -.3]} s={[.26, .09, 5.8]} color="#b9a3bd" />
      <Box p={[0, .32, -2.94]} s={[8.3, .065, .04]} color={C.orange} glow={1.4} /><Box p={[-4.02, .32, -.25]} s={[.045, .065, 5.4]} color={C.orange} glow={1.4} />
      <mesh position={[.25, .19, 1.1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1.85, 64]} /><meshStandardMaterial color="#b49bbb" roughness={1} /></mesh>
      <mesh position={[.25, .195, 1.1]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.55, 1.58, 64]} /><meshStandardMaterial color="#d0b6c7" /></mesh>
      {/* A real, constructed bookshelf: warm wood, books and an illuminated edge. */}
      <group position={[-2.8, 0, -1.94]} onClick={e => { e.stopPropagation(); navigate('blog'); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        <Box p={[0, 1.38, 0]} s={[1.72, 2.43, .52]} color="#685265" round />
        <Box p={[0, 1.38, .29]} s={[1.55, 2.2, .04]} color="#493d51" />
        {[.4, 1.08, 1.78, 2.49].map(y => <Box key={y} p={[0, y, .3]} s={[1.77, .09, .65]} color="#c99576" />)}
        {Array.from({ length: 17 }, (_, i) => { const row = Math.floor(i / 6); return <Box key={i} p={[-.65 + (i % 6) * .23, .67 + row * .7, .36]} s={[.16, .4 + (i % 3) * .05, .37]} color={['#edb57f', '#b4c1a0', '#b3a0c5', '#a16e77', '#eadbc1'][i % 5]} rotation={[0, 0, i === 5 ? -.16 : 0]} />; })}
        <Plant p={[.4, 2.54, 0]} scale={.48} />
        <Beacon p={[.72, 2.56, .38]} reduced={reduced} />
      </group>
      {/* Desk, dual monitors, keyboard and a small mug. */}
      <group position={[.15, 0, -1.48]} onClick={e => { e.stopPropagation(); navigate('projects'); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        <Box p={[.15, 1.16, 0]} s={[3.55, .16, 1.22]} color="#d49f78" round />
        {[-1.35, 1.62].map(x => <Box key={x} p={[x, .65, 0]} s={[.12, 1.05, .85]} color="#433b51" />)}
        <Screen p={[-.53, 1.95, -.27]} /><Screen p={[.85, 1.95, -.23]} size={[1.2, .86, .1]} color="#d2a1ee" />
        {[-.53, .85].map(x => <group key={x}><Box p={[x, 1.47, -.29]} s={[.08, .38, .08]} color={C.dark} /><Box p={[x, 1.26, -.2]} s={[.47, .05, .26]} color={C.dark} /></group>)}
        <Box p={[.05, 1.27, .32]} s={[1.35, .04, .32]} color="#7b7185" round />
        {Array.from({ length: 12 }, (_, i) => <Box key={i} p={[-.5 + (i % 6) * .21, 1.298, .23 + Math.floor(i / 6) * .14]} s={[.14, .008, .075]} color="#d6c7cf" />)}
        <Cylinder p={[1.31, 1.4, .24]} r={.13} h={.28} color={C.orange} /><Cylinder p={[1.31, 1.55, .24]} r={.1} h={.012} color="#4b3e3b" />
        <Beacon p={[1.55, 1.48, .43]} color="#bce9cd" reduced={reduced} />
      </group>
      {/* Chair. */}
      <group position={[.23, 0, .03]} rotation={[0, -.32, 0]}><Box p={[0, .74, 0]} s={[.87, .2, .86]} color="#7b668b" round /><Box p={[0, 1.21, .31]} s={[.87, .89, .17]} color="#8e789b" rotation={[-.08, 0, 0]} round /><Cylinder p={[0, .4, 0]} r={.06} h={.6} color={C.dark} />{[0, 1, 2, 3, 4].map(i => <group key={i} rotation={[0, i * Math.PI / 2.5, 0]}><Box p={[.23, .2, 0]} s={[.58, .06, .06]} color={C.dark} /></group>)}</group>
      {/* Community pinboard. */}
      <group position={[2.95, 2.12, -2.94]} onClick={e => { e.stopPropagation(); navigate('forum'); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        <Box p={[0, 0, 0]} s={[1.76, 1.63, .13]} color="#bc8866" round /><Box p={[0, 0, .078]} s={[1.56, 1.44, .025]} color="#947471" />
        {[[ -.37, .29], [.34, .22], [-.3, -.4], [.37, -.35]].map(([x, y], i) => <group key={i} position={[x, y, .115]} rotation={[0, 0, (i % 2 ? 1 : -1) * .12]}><Box p={[0, 0, 0]} s={[.52, .49, .013]} color={['#efd3a0', '#bdd7ba', '#d8b6de', '#eab68f'][i]} /><mesh position={[0, .18, .03]}><sphereGeometry args={[.035, 8, 8]} /><meshStandardMaterial color="#e16e66" /></mesh>{[0, 1, 2].map(j => <Box key={j} p={[-.03, .04 - j * .09, .012]} s={[.29 - j * .05, .017, .005]} color="#947e84" />)}</group>)}
        <Beacon p={[.66, .58, .18]} color="#ffcf8b" reduced={reduced} />
      </group>
      {/* Circular night-sky window. */}
      <mesh position={[-.33, 2.92, -2.978]}><circleGeometry args={[.51, 48]} /><meshStandardMaterial color="#39375a" emissive="#555195" emissiveIntensity={.25} /></mesh>
      <mesh position={[-.33, 2.92, -2.955]}><torusGeometry args={[.54, .055, 12, 64]} /><meshStandardMaterial color="#e0c5a8" /></mesh>
      <mesh position={[-.18, 3.04, -2.92]}><sphereGeometry args={[.17, 24, 24]} /><meshStandardMaterial color="#efc68e" emissive="#efc68e" emissiveIntensity={.5} /></mesh>
      {/* Server rack and desk lamp. */}
      <group onClick={e => { e.stopPropagation(); navigate('dashboard'); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}><Box p={[3.22, .74, -.95]} s={[.83, 1.12, .95]} color="#454151" round />
      {[0, 1, 2].map(i => <group key={i}><Box p={[3.22, 1.07 - i * .29, -.465]} s={[.64, .17, .022]} color="#252836" /><Box p={[3.42, 1.07 - i * .29, -.448]} s={[.05, .04, .012]} color={C.cyan} glow={2} /></group>)}<Beacon p={[3.6, 1.33, -.42]} color="#aee6ff" reduced={reduced} /></group>
      <Cylinder p={[1.85, 1.37, -1.8]} r={.15} h={.06} color={C.dark} /><Cylinder p={[1.85, 1.82, -1.8]} r={.025} h={.9} color={C.dark} />
      <mesh position={[1.85, 2.29, -1.8]}><coneGeometry args={[.27, .24, 24, 1, true]} /><meshStandardMaterial color={C.orange} side={THREE.DoubleSide} emissive={C.orange} emissiveIntensity={.25} /></mesh>
      {/* Personal corner: plant, a floor cushion and a tiny cat. */}
      <Plant p={[-3.24, .2, 1.87]} scale={1.35} />
      <Box p={[-2.22, .4, 1.9]} s={[1.08, .4, .9]} color="#deae7f" round />
      <group position={[-2.18, .75, 1.9]}><mesh scale={[.37, .2, .23]} castShadow><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#f0d5bc" /></mesh><mesh position={[.23, .1, .1]} castShadow><sphereGeometry args={[.19, 12, 12]} /><meshStandardMaterial color="#f0d5bc" /></mesh>{[.12, .33].map(x => <mesh key={x} position={[x, .28, .1]}><coneGeometry args={[.075, .16, 4]} /><meshStandardMaterial color="#e5b99a" /></mesh>)}</group>
      <Robot active={chatting} onClick={chat} reduced={reduced} />
      <Hotspot p={[2.95, 2.55, 1.73]} label="和小潘聊聊" color="#bce9cd" onClick={chat} />
    </group>
    <Float speed={reduced ? 0 : .8} floatIntensity={.25}><group position={[-5.5, 3.4, -3]} rotation={[.45, 0, -.35]}><mesh><sphereGeometry args={[.48, 32, 24]} /><meshStandardMaterial color="#d3b19e" roughness={.8} /></mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.8, .025, 8, 64]} /><meshStandardMaterial color="#b39ad0" /></mesh></group></Float>
    <ContactShadows position={[0, -1.25, 0]} opacity={.4} scale={20} blur={3} far={5} resolution={256} color="#000000" />
    <OrbitControls makeDefault target={[0, 1.05, 0]} enablePan={false} enableZoom={false} minPolarAngle={.7} maxPolarAngle={1.3} minAzimuthAngle={-.6} maxAzimuthAngle={1.3} autoRotate={!reduced} autoRotateSpeed={.35} />
  </>;
}
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> { state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; } render() { return this.state.failed ? this.props.fallback : this.props.children; } }
export default function World(props: { navigate: (s: Section) => void; chat: () => void; chatting: boolean; reduced: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const supported = useMemo(() => { try { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return false; g.getExtension('WEBGL_lose_context')?.loseContext(); return true; } catch { return false; } }, []);
  const fallback = <div className="scene-fallback"><span>✦</span><h2>欢迎来到潘潘的工作室</h2><p>当前设备使用轻量浏览模式，所有内容仍然可以访问。</p><button className="primary" onClick={() => props.navigate('blog')}>打开灵感书架 ↗</button></div>;
  return <div className={'scene-wrap ' + (loaded ? 'scene-loaded' : '')}>
    <SceneBoundary fallback={fallback}>{supported ? <Suspense fallback={<div className="scene-loading">正在点亮工作室 <span>···</span></div>}><Canvas shadows orthographic camera={{ position: [10, 9, 12], zoom: 65 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => { gl.setClearColor('#000000', 0); setLoaded(true); }}><Room {...props} /></Canvas></Suspense> : fallback}</SceneBoundary>
  </div>;
}
