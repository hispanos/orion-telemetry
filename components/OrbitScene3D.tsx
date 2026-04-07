"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Html,
  Line,
  OrbitControls,
  PerspectiveCamera,
  Stars,
  useTexture,
} from "@react-three/drei";
import {
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";

export type VecKm = { x: number; y: number; z: number };

const EARTH_R_KM = 6378.137;
const MOON_R_KM = 1737.4;
const TRAIL_MAIN = "#d8b4fe";
const TRAIL_UNDER = "#7c3aed";

/** Multiplicador base sobre el radio físico (se mezcla con suelo/cap según el alcance de la escena). */
const BODY_VIS_MULT = 6.8;

function kmToThree(v: VecKm, invScale: number): THREE.Vector3 {
  return new THREE.Vector3(v.x * invScale, v.z * invScale, v.y * invScale);
}

function distKm(a: VecKm, b: VecKm): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Polilínea hasta el instante `playheadJd`: muestras hasta el segmento activo + posición
 * interpolada de Orion (coincide con el slider / reloj).
 */
function trailLinePointsToPlayhead(
  trajectoryKm: VecKm[],
  sampleJds: number[],
  playheadJd: number,
  orionKm: VecKm,
  invS: number
): THREE.Vector3[] {
  const n = trajectoryKm.length;
  if (n === 0) return [];
  if (n === 1) return [kmToThree(trajectoryKm[0]!, invS)];
  if (sampleJds.length !== n) {
    return trajectoryKm.map((p) => kmToThree(p, invS));
  }

  let seg = 0;
  while (seg < n - 1 && sampleJds[seg + 1]! <= playheadJd) seg++;

  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= seg; k++) {
    pts.push(kmToThree(trajectoryKm[k]!, invS));
  }
  if (seg < n - 1) {
    pts.push(kmToThree(orionKm, invS));
  }
  return pts;
}

function useTrajectoryScaleKm(trajectoryKm: VecKm[]): number {
  return useMemo(() => {
    let maxR = 0;
    for (const p of trajectoryKm) {
      maxR = Math.max(maxR, Math.hypot(p.x, p.y, p.z));
    }
    maxR = Math.max(maxR, 400_000);
    return maxR * 1.2;
  }, [trajectoryKm]);
}

function useTrajectoryTangentThree(
  trajectoryKm: VecKm[],
  orionKm: VecKm,
  invS: number
): THREE.Vector3 {
  return useMemo(() => {
    if (trajectoryKm.length < 2) return new THREE.Vector3(0, 0, 1);
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < trajectoryKm.length; i++) {
      const p = trajectoryKm[i]!;
      const d = distKm(p, orionKm);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const i0 = Math.max(0, bestI - 1);
    const i1 = Math.min(trajectoryKm.length - 1, bestI + 1);
    const a = trajectoryKm[i0]!;
    const b = trajectoryKm[i1]!;
    const t = kmToThree(
      { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z },
      invS
    );
    if (t.lengthSq() < 1e-14) return new THREE.Vector3(0, 0, 1);
    return t.normalize();
  }, [trajectoryKm, orionKm, invS]);
}

function EarthWithAtmosphere({
  radius,
  map,
}: {
  radius: number;
  map: THREE.Texture;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.07;
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 72, 72]} />
        <meshStandardMaterial
          map={map}
          roughness={0.38}
          metalness={0.12}
          emissive="#0a2840"
          emissiveIntensity={0.28}
        />
      </mesh>
      <mesh scale={radius * 1.085}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          color="#5eb3ff"
          transparent
          opacity={0.14}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh scale={radius * 1.12}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#3d7ab8"
          transparent
          opacity={0.06}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function OrionSpacecraft3D({
  position,
  tangent,
  scale: L,
}: {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  scale: number;
}) {
  const group = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.position.copy(position);
    const dir = tangent.clone();
    if (dir.lengthSq() < 1e-12) dir.set(0, 0, 1);
    else dir.normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }, [position, tangent]);

  const panelAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const;

  return (
    <group ref={group}>
      <mesh position={[0, 0, -0.14 * L]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15 * L, 0.19 * L, 0.38 * L, 24]} />
        <meshStandardMaterial
          color="#6a7388"
          metalness={0.62}
          roughness={0.35}
          emissive="#202838"
          emissiveIntensity={0.15}
        />
      </mesh>

      <mesh position={[0, 0, 0.16 * L]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.11 * L, 0.26 * L, 10, 20]} />
        <meshStandardMaterial
          color="#f0f2fa"
          metalness={0.32}
          roughness={0.32}
          emissive="#404858"
          emissiveIntensity={0.1}
        />
      </mesh>

      <mesh position={[0, 0, 0.38 * L]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1 * L, 0.16 * L, 14]} />
        <meshStandardMaterial
          color="#d0d4e0"
          metalness={0.42}
          roughness={0.38}
        />
      </mesh>

      <mesh position={[0, 0, 0.46 * L]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11 * L, 0.11 * L, 0.02 * L, 20]} />
        <meshStandardMaterial
          color="#9a8060"
          metalness={0.55}
          roughness={0.48}
          emissive="#2a2218"
          emissiveIntensity={0.08}
        />
      </mesh>

      {panelAngles.map((a, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(a) * 0.24 * L,
            Math.sin(a) * 0.24 * L,
            -0.06 * L,
          ]}
          rotation={[0, 0, a]}
        >
          <boxGeometry args={[0.05 * L, 0.58 * L, 0.012 * L]} />
          <meshStandardMaterial
            color="#243a5c"
            metalness={0.9}
            roughness={0.18}
            emissive="#0c1830"
            emissiveIntensity={0.45}
          />
        </mesh>
      ))}
    </group>
  );
}

type OrbitControlsLike = {
  target: THREE.Vector3;
  update: () => void;
};

/**
 * Ajusta cámara y target de OrbitControls solo cuando cambia `fitKey` (nueva ephemeris),
 * no al mover el slider ni al orbitar con el ratón.
 */
function InitialCameraRig({
  fitKey,
  position,
  target,
}: {
  fitKey: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
}) {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const controls = useThree((s) => s.controls as OrbitControlsLike | null);
  const appliedFit = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!controls) return;
    if (appliedFit.current === fitKey) return;
    appliedFit.current = fitKey;

    camera.position.copy(position);
    camera.lookAt(target);

    controls.target.copy(target);
    controls.update();
  }, [fitKey, position, target, camera, controls]);

  return null;
}

function SceneBody({
  orionKm,
  moonKm,
  moonKmForBounds,
  trajectoryKm,
  playheadJd,
  sampleJds,
}: {
  orionKm: VecKm;
  moonKm: VecKm;
  moonKmForBounds: VecKm;
  trajectoryKm: VecKm[];
  /** Con {@link sampleJds}, recorta la línea violeta hasta el instante del slider/reloj. */
  playheadJd: number | null;
  sampleJds: number[];
}) {
  const scaleKm = useTrajectoryScaleKm(trajectoryKm);
  const invS = 1 / scaleKm;

  const linePts = useMemo(
    () => trajectoryKm.map((p) => kmToThree(p, invS)),
    [trajectoryKm, invS]
  );

  const visibleTrailPts = useMemo(() => {
    if (
      playheadJd == null ||
      trajectoryKm.length < 2 ||
      sampleJds.length !== trajectoryKm.length
    ) {
      return trajectoryKm.map((p) => kmToThree(p, invS));
    }
    return trailLinePointsToPlayhead(
      trajectoryKm,
      sampleJds,
      playheadJd,
      orionKm,
      invS
    );
  }, [trajectoryKm, sampleJds, playheadJd, orionKm, invS]);

  const moonPos = useMemo(() => kmToThree(moonKm, invS), [moonKm, invS]);
  const moonPosBounds = useMemo(
    () => kmToThree(moonKmForBounds, invS),
    [moonKmForBounds, invS]
  );
  const orionPos = useMemo(() => kmToThree(orionKm, invS), [orionKm, invS]);

  /**
   * Encuadre estable: Luna fija al punto medio del intervalo (no la Luna interpolada del
   * slider), para que sceneCenter / extent no cambien al hacer scrub y no se resetee la cámara.
   */
  const { sceneExtent, sceneCenter } = useMemo(() => {
    const box = new THREE.Box3();
    box.expandByPoint(new THREE.Vector3(0, 0, 0));
    box.expandByPoint(moonPosBounds);
    for (const p of linePts) box.expandByPoint(p);
    const c = new THREE.Vector3();
    box.getCenter(c);
    const size = new THREE.Vector3();
    box.getSize(size);
    const half = Math.max(size.x, size.y, size.z) * 0.55;
    const fromOrigin = Math.max(moonPosBounds.length(), 0.25);
    const fromLine = linePts.reduce((m, p) => Math.max(m, p.length()), 0);
    const extent = Math.max(half, fromOrigin, fromLine, 0.28) * 1.05;
    return { sceneExtent: extent, sceneCenter: c };
  }, [linePts, moonPosBounds]);

  const minOrionRadiusScene = useMemo(() => {
    if (trajectoryKm.length === 0) return sceneExtent * 0.08;
    let m = Infinity;
    for (const p of trajectoryKm) {
      m = Math.min(m, Math.hypot(p.x, p.y, p.z) * invS);
    }
    return Number.isFinite(m) ? m : sceneExtent * 0.08;
  }, [trajectoryKm, invS, sceneExtent]);

  const minOrionMoonScene = useMemo(() => {
    if (trajectoryKm.length === 0) return sceneExtent * 0.06;
    let m = Infinity;
    for (const p of trajectoryKm) {
      m = Math.min(m, distKm(p, moonKmForBounds) * invS);
    }
    return Number.isFinite(m) ? m : sceneExtent * 0.06;
  }, [trajectoryKm, moonKmForBounds, invS, sceneExtent]);

  const rEarthPhys = EARTH_R_KM / scaleKm;
  const rMoonPhys = MOON_R_KM / scaleKm;
  const earthMoonDist = moonPos.length();

  const rEarthFloor = sceneExtent * 0.05;
  const rEarthDesired = rEarthPhys * BODY_VIS_MULT;
  const rEarthCap = Math.min(
    sceneExtent * 0.14,
    minOrionRadiusScene * 0.88
  );
  const rEarth = Math.max(rEarthFloor, Math.min(rEarthDesired, rEarthCap));

  const rMoonFloor = sceneExtent * 0.018;
  const rMoonDesired = rMoonPhys * BODY_VIS_MULT;
  const rMoonCap = Math.min(
    sceneExtent * 0.055,
    minOrionMoonScene * 0.42,
    earthMoonDist * 0.13,
    rEarth * 0.42
  );
  const rMoon = Math.max(
    rMoonFloor,
    Math.min(rMoonDesired, rMoonCap, rEarth * 0.4)
  );

  const tangentThree = useTrajectoryTangentThree(trajectoryKm, orionKm, invS);

  const craftScale = useMemo(() => {
    const lo = sceneExtent * 0.022;
    const hi = sceneExtent * 0.04;
    return THREE.MathUtils.clamp(rEarth * 0.62, lo, hi);
  }, [rEarth, sceneExtent]);

  const maxTrailRadius = sceneExtent * 1.08;

  const camPos = useMemo(() => {
    const e = sceneExtent;
    const off = new THREE.Vector3(e * 0.72, e * 0.48, e * 0.7);
    return sceneCenter.clone().add(off);
  }, [sceneCenter, sceneExtent]);

  const cameraFitKey = useMemo(() => {
    if (trajectoryKm.length === 0) return "empty";
    const a = trajectoryKm[0]!;
    const b = trajectoryKm[trajectoryKm.length - 1]!;
    return `${trajectoryKm.length}|${a.x},${a.y},${a.z}|${b.x},${b.y},${b.z}`;
  }, [trajectoryKm]);

  /** Menor = etiquetas más discretas frente a la escena 3D. */
  const labelDf = sceneExtent * 1.45;

  const [earthTex, moonTex] = useTexture(["/textures/earth.jpg", "/textures/moon.jpg"]);

  for (const t of [earthTex, moonTex]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 12;
  }

  const moonOrionSep = useMemo(() => {
    const d = orionPos.clone().sub(moonPos);
    const len = d.length();
    if (len < 1e-6) return new THREE.Vector3(0, 1, 0);
    return d.multiplyScalar(1 / len);
  }, [moonPos, orionPos]);

  const moonLabelPos = useMemo(() => {
    const down = new THREE.Vector3(0, -rMoon * 1.55, 0);
    const away = moonOrionSep.clone().multiplyScalar(-rMoon * 1.25);
    return moonPos.clone().add(down).add(away);
  }, [moonPos, rMoon, moonOrionSep]);

  const orionLabelPos = useMemo(() => {
    const down = new THREE.Vector3(0, -craftScale * 1.05, 0);
    const away = moonOrionSep.clone().multiplyScalar(craftScale * 1.2);
    return orionPos.clone().add(away).add(down);
  }, [orionPos, craftScale, moonOrionSep]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={44}
        near={sceneExtent * 0.0012}
        far={sceneExtent * 120}
      />
      <InitialCameraRig
        fitKey={cameraFitKey}
        position={camPos}
        target={sceneCenter}
      />

      <color attach="background" args={["#050810"]} />

      <ambientLight intensity={0.38} />
      <hemisphereLight
        color="#c8d8f0"
        groundColor="#1a1520"
        intensity={0.55}
      />
      <directionalLight position={[8, 12, 6]} intensity={2.35} color="#fff6ec" />
      <directionalLight position={[-5, 3, -8]} intensity={0.5} color="#a8c6ff" />
      <pointLight position={[2, 2.5, 1.5]} intensity={10} distance={sceneExtent * 8} decay={2} color="#fff0dd" />

      <Stars
        radius={sceneExtent * 28}
        depth={sceneExtent * 12}
        count={7000}
        factor={2.8}
        saturation={0.05}
        fade
        speed={0.15}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <ringGeometry args={[rEarth * 1.03, maxTrailRadius, 112]} />
        <meshBasicMaterial
          color="#2a4a78"
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <EarthWithAtmosphere radius={rEarth} map={earthTex} />

      <Html position={[0, -rEarth * 1.42, 0]} center distanceFactor={labelDf}>
        <span
          className="select-none whitespace-nowrap text-[9px] font-semibold tracking-[0.1em] text-sky-300"
          style={{ textShadow: "0 0 10px #000, 0 1px 6px #000" }}
        >
          TIERRA
        </span>
      </Html>

      <mesh position={moonPos}>
        <sphereGeometry args={[rMoon, 56, 56]} />
        <meshPhysicalMaterial
          map={moonTex}
          roughness={0.88}
          metalness={0.02}
          clearcoat={0.22}
          clearcoatRoughness={0.45}
          emissive="#080808"
          emissiveIntensity={0.06}
        />
      </mesh>

      <Html position={moonLabelPos} center distanceFactor={labelDf * 1.02}>
        <span
          className="select-none whitespace-nowrap text-[8px] font-semibold tracking-[0.09em] text-slate-100"
          style={{ textShadow: "0 0 10px #000, 0 1px 6px #000" }}
        >
          LUNA
        </span>
      </Html>

      {visibleTrailPts.length >= 2 ? (
        <>
          <Line
            points={visibleTrailPts}
            color={TRAIL_UNDER}
            lineWidth={12}
            transparent
            opacity={0.4}
          />
          <Line points={visibleTrailPts} color={TRAIL_MAIN} lineWidth={4.8} />
        </>
      ) : null}

      <OrionSpacecraft3D
        position={orionPos}
        tangent={tangentThree}
        scale={craftScale}
      />

      <Html position={orionLabelPos} center distanceFactor={labelDf * 0.98}>
        <div
          className="select-none text-center"
          style={{ textShadow: "0 0 10px #000, 0 1px 6px #000" }}
        >
          <div className="text-[9px] font-bold tracking-[0.06em] text-amber-300">
            ORION
          </div>
          <div className="text-[7px] font-medium tracking-[0.14em] text-amber-200/90">
            INTEGRITY
          </div>
        </div>
      </Html>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        minDistance={sceneExtent * 0.035}
        maxDistance={sceneExtent * 3.6}
        maxPolarAngle={Math.PI - 0.06}
      />
    </>
  );
}

export function OrbitScene3D({
  orionKm,
  moonKm,
  moonKmForBounds,
  trajectoryKm,
  playheadJd = null,
  sampleJds = [],
  children,
}: {
  orionKm: VecKm;
  moonKm: VecKm;
  /** Luna representativa para encuadre (p. ej. muestra central); estable al mover el slider. */
  moonKmForBounds: VecKm;
  trajectoryKm: VecKm[];
  /** JD del instante mostrado (misma escala que muestras Horizons). Con `sampleJds` recorta el trazo. */
  playheadJd?: number | null;
  /** Un JD por punto de `trajectoryKm` (mismo orden). */
  sampleJds?: number[];
  /** Panel inferior (p. ej. control de tiempo) dentro del mismo marco que el Canvas. */
  children?: ReactNode;
}) {
  return (
    <div className="flex h-[min(92vh,800px)] min-h-[460px] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#050810] shadow-inner">
      <div className="relative min-h-[min(42vh,380px)] flex-1">
        <Canvas
          className="absolute inset-0 h-full w-full touch-none"
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <SceneBody
              orionKm={orionKm}
              moonKm={moonKm}
              moonKmForBounds={moonKmForBounds}
              trajectoryKm={trajectoryKm}
              playheadJd={playheadJd}
              sampleJds={sampleJds}
            />
          </Suspense>
        </Canvas>
      </div>
      {children ? (
        <div className="shrink-0 border-t border-violet-500/30 bg-gradient-to-b from-zinc-950 via-zinc-950 to-black px-4 py-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
