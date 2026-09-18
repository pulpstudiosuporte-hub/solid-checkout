"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useTexture } from '@react-three/drei';
import { Pause, Play, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { globePosition, validGlobeCoordinate } from './globe-coordinates';
import './3d-globe.css';

export interface GlobeMarker {
  lat: number;
  lng: number;
  src?: string;
  label?: string;
  size?: number;
}

export interface Globe3DConfig {
  radius?: number;
  globeColor?: string;
  textureUrl?: string;
  bumpMapUrl?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereIntensity?: number;
  atmosphereBlur?: number;
  bumpScale?: number;
  autoRotateSpeed?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  minDistance?: number;
  maxDistance?: number;
  initialRotation?: { x: number; y: number };
  markerSize?: number;
  showWireframe?: boolean;
  wireframeColor?: string;
  ambientIntensity?: number;
  pointLightIntensity?: number;
  backgroundColor?: string | null;
}

export interface Globe3DProps {
  markers?: GlobeMarker[];
  config?: Globe3DConfig;
  className?: string;
  active?: boolean;
  onMarkerClick?: (marker: GlobeMarker) => void;
  onMarkerHover?: (marker: GlobeMarker | null) => void;
  onUnavailable?: () => void;
  onReady?: () => void;
}

const defaults: Required<Globe3DConfig> = {
  radius: 2, globeColor: '#ffffff',
  textureUrl: '/illustrations/globe/earth.jpg',
  bumpMapUrl: '/illustrations/globe/elevation.png',
  showAtmosphere: true, atmosphereColor: '#ffdf99', atmosphereIntensity: 0.22,
  atmosphereBlur: 3, bumpScale: 1, autoRotateSpeed: 0.3,
  enableZoom: false, enablePan: false, minDistance: 5, maxDistance: 15,
  initialRotation: { x: 0, y: 0 }, markerSize: 0.045,
  showWireframe: false, wireframeColor: '#c9bdb3',
  ambientIntensity: 1.8, pointLightIntensity: 2, backgroundColor: null,
};

function Unavailable({ notify }: { notify: (() => void) | undefined }) {
  useEffect(() => { notify?.(); }, [notify]);
  return <p className="globe-loading">O globo 3D está indisponível neste navegador.</p>;
}

function Marker({ marker, radius, size, selected, onClick, onHover }: {
  marker: GlobeMarker; radius: number; size: number; selected: boolean;
  onClick: () => void; onHover: (marker: GlobeMarker | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const position = useMemo(() => new THREE.Vector3(...globePosition(marker.lat, marker.lng, radius)), [marker.lat, marker.lng, radius]);
  const rotation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), position.clone().normalize()), [position]);
  const markerSize = marker.size ?? size;
  return <group position={position} quaternion={rotation}>
    <mesh position={[0, radius * 0.035, 0]}>
      <cylinderGeometry args={[0.006, 0.006, radius * 0.07, 6]}/>
      <meshBasicMaterial color="#ffdf99"/>
    </mesh>
    <mesh position={[0, radius * 0.075, 0]}
      onClick={event => { event.stopPropagation(); onClick(); }}
      onPointerOver={event => { event.stopPropagation(); setHovered(true); onHover(marker); }}
      onPointerOut={() => { setHovered(false); onHover(null); }}>
      <sphereGeometry args={[markerSize * (hovered || selected ? 1.5 : 1), 12, 8]}/>
      <meshBasicMaterial color={hovered || selected ? '#ffffff' : '#ffbc21'}/>
    </mesh>
    <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[markerSize * 1.1, markerSize * 1.6, 16]}/>
      <meshBasicMaterial color="#ffbc21" side={THREE.DoubleSide}/>
    </mesh>
    {marker.src && <Html position={[0, radius * 0.15, 0]} center sprite occlude>
      <button type="button" className="globe-photo-marker" onClick={onClick} aria-label={marker.label || 'Ver localização'}>
        <img src={marker.src} alt="" draggable={false}/>
      </button>
    </Html>}
  </group>;
}

function Atmosphere({ config }: { config: Required<Globe3DConfig> }) {
  const uniforms = useMemo(() => ({
    atmosphereColor: { value: new THREE.Color(config.atmosphereColor) },
    intensity: { value: config.atmosphereIntensity },
    fresnelPower: { value: Math.max(0.5, 5 - config.atmosphereBlur) },
  }), [config.atmosphereColor, config.atmosphereIntensity, config.atmosphereBlur]);
  return <mesh scale={1.08}>
    <sphereGeometry args={[config.radius, 48, 32]}/>
    <shaderMaterial uniforms={uniforms} side={THREE.BackSide} transparent depthWrite={false}
      vertexShader={`varying vec3 vNormal; varying vec3 vPosition;
        void main() { vNormal = normalize(normalMatrix * normal); vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
      fragmentShader={`uniform vec3 atmosphereColor; uniform float intensity; uniform float fresnelPower;
        varying vec3 vNormal; varying vec3 vPosition;
        void main() { float edge = abs(dot(normalize(vNormal), normalize(-vPosition)));
          float fresnel = pow(1.0 - edge, fresnelPower) * smoothstep(0.0, 0.3, edge);
          gl_FragColor = vec4(atmosphereColor, fresnel * intensity); }`}/>
  </mesh>;
}

function Earth({ config, markers, selected, onSelect, onHover, onReady }: {
  config: Required<Globe3DConfig>; markers: GlobeMarker[]; selected: GlobeMarker | undefined;
  onSelect: (marker: GlobeMarker) => void; onHover: (marker: GlobeMarker | null) => void;
  onReady: (() => void) | undefined;
}) {
  const textures = useTexture([config.textureUrl, config.bumpMapUrl]);
  const ready = useRef(false);
  useEffect(() => {
    if (textures[0]) { textures[0].colorSpace = THREE.SRGBColorSpace; textures[0].anisotropy = 4; textures[0].needsUpdate = true; }
  }, [textures]);
  useFrame(() => { if (!ready.current) { ready.current = true; onReady?.(); } });
  return <group rotation={[config.initialRotation.x, config.initialRotation.y, 0]}>
    <mesh onPointerOver={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <sphereGeometry args={[config.radius, 64, 48]}/>
      <meshStandardMaterial map={textures[0] ?? null} bumpMap={textures[1] ?? null} bumpScale={config.bumpScale * 0.05} color={config.globeColor} roughness={0.8}/>
    </mesh>
    {config.showWireframe && <mesh>
      <sphereGeometry args={[config.radius * 1.002, 32, 16]}/>
      <meshBasicMaterial color={config.wireframeColor} wireframe transparent opacity={0.08}/>
    </mesh>}
    {markers.map((marker, index) => <Marker key={`${marker.lat}-${marker.lng}-${index}`} marker={marker} radius={config.radius}
      size={config.markerSize} selected={selected === marker} onClick={() => onSelect(marker)} onHover={onHover}/>)}
  </group>;
}

function CameraPosition({ config, focus, reset }: { config: Required<Globe3DConfig>; focus: GlobeMarker | undefined; reset: number }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    // Fit the sphere in portrait and landscape without stretching its coordinates.
    const distance = config.radius * 3.4 * Math.max(1, size.height / Math.max(size.width, 1));
    const position = new THREE.Vector3(...globePosition(focus?.lat ?? -15, focus?.lng ?? -50, distance));
    position.applyEuler(new THREE.Euler(config.initialRotation.x, config.initialRotation.y, 0));
    camera.position.copy(position);
    camera.lookAt(0, 0, 0);
    invalidate();
  }, [camera, size.width, size.height, config.radius, config.initialRotation.x, config.initialRotation.y, focus, reset, invalidate]);
  return null;
}

function ContextLossHandler({ notify }: { notify: (() => void) | undefined }) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = () => notify?.();
    gl.domElement.addEventListener('webglcontextlost', lost);
    // Fiber deliberately loses the context after unmount. Ignore that cleanup event.
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl, notify]);
  return null;
}

export function Globe3D({ markers = [], config = {}, className = '', active = true, onMarkerClick, onMarkerHover, onUnavailable, onReady }: Globe3DProps) {
  const merged = useMemo(() => ({ ...defaults, ...config }), [config]);
  const validMarkers = useMemo(() => markers.filter(marker => validGlobeCoordinate(marker.lat, marker.lng)), [markers]);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState('');
  const [hovered, setHovered] = useState<GlobeMarker | null>(null);
  const [reset, setReset] = useState(0);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const selected = validMarkers[Number.parseInt(selectedIndex, 10)];
  const rotating = active && !paused && !reducedMotion && merged.autoRotateSpeed > 0;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => { setSelectedIndex(''); setHovered(null); }, [markers]);
  useEffect(() => {
    try {
      const probe = document.createElement('canvas');
      const context = probe.getContext('webgl2');
      setSupported(Boolean(context));
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { setSupported(false); }
  }, []);
  const select = (marker: GlobeMarker) => { setSelectedIndex(String(validMarkers.indexOf(marker))); setPaused(true); onMarkerClick?.(marker); };
  const hover = (marker: GlobeMarker | null) => { setHovered(marker); onMarkerHover?.(marker); };
  if (supported === null) return <p className="globe-loading" role="status">Preparando globo...</p>;
  if (!supported) return <Unavailable notify={onUnavailable}/>;
  return <div className={`globe-3d ${className}`} data-state={ready ? 'ready' : 'loading'} data-rotating={rotating} data-marker-count={validMarkers.length}
    style={{ backgroundColor: merged.backgroundColor ?? undefined }}>
    <div className="globe-canvas" aria-label={`Globo com ${validMarkers.length} localizações aproximadas por IP`} role="img">
      <Canvas gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} dpr={[1, 1.5]}
        frameloop={rotating ? 'always' : 'demand'} camera={{ fov: 45, near: 0.1, far: 100, position: globePosition(-15, -50, merged.radius * 3.4) }}
        fallback={<p>Seu navegador não suporta o globo 3D.</p>}>
        <ContextLossHandler notify={onUnavailable}/>
        <CameraPosition config={merged} focus={selected} reset={reset}/>
        <ambientLight intensity={merged.ambientIntensity}/>
        <directionalLight position={[5, 3, 5]} intensity={merged.pointLightIntensity}/>
        <directionalLight position={[-3, 1, -2]} intensity={merged.pointLightIntensity * 0.3} color="#fff3de"/>
        <Suspense fallback={null}>
          <Earth config={merged} markers={validMarkers} selected={selected} onSelect={select} onHover={hover}
            onReady={() => { setReady(true); onReady?.(); }}/>
          {merged.showAtmosphere && <Atmosphere config={merged}/>}
        </Suspense>
        <OrbitControls makeDefault enablePan={merged.enablePan} enableZoom={merged.enableZoom} minDistance={merged.minDistance} maxDistance={merged.maxDistance}
          rotateSpeed={0.4} autoRotate={rotating} autoRotateSpeed={merged.autoRotateSpeed} enableDamping={active} dampingFactor={0.1}
          onStart={() => setPaused(true)}/>
      </Canvas>
    </div>
    {!ready && <p className="globe-loading" role="status">Carregando globo...</p>}
    {ready && <>
      <p className="globe-hint">{hovered?.label || selected?.label || 'Arraste para explorar'}</p>
      <div className="globe-controls">
        {!reducedMotion && merged.autoRotateSpeed > 0 && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Retomar rotação' : 'Pausar rotação'}>
          {paused ? <Play size={14}/> : <Pause size={14}/>}<span>{paused ? 'Girar' : 'Pausar'}</span>
        </button>}
        <button type="button" onClick={() => { setSelectedIndex(''); setReset(value => value + 1); setPaused(true); }} aria-label="Centralizar no Brasil"><RotateCcw size={14}/><span>Brasil</span></button>
      </div>
      {validMarkers.length > 0 && <select className="globe-locations" aria-label="Explorar localização" value={selectedIndex} onChange={event => {
        const marker = validMarkers[Number.parseInt(event.target.value, 10)]; if (marker) select(marker);
      }}>
        <option value="" disabled>Explorar localizações</option>
        {validMarkers.map((marker, index) => <option key={index} value={index}>{marker.label || `${marker.lat}, ${marker.lng}`}</option>)}
      </select>}
    </>}
  </div>;
}

export default Globe3D;
