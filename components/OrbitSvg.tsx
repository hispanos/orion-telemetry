"use client";

import { useId, useMemo } from "react";
import {
  boundsFromTrajectory3D,
  projectKmToSvg,
  type EclipticPlane,
} from "@/lib/svg-orbit";

type VecKm = { x: number; y: number; z: number };

const IMG_EARTH = "/textures/earth.jpg";
const IMG_MOON = "/textures/moon.jpg";
const IMG_ORION = "/textures/orion.jpg";

const TRAIL_UNDER = "#6d28d9";
const TRAIL_MAIN = "#c084fc";

const PANEL_W = 1680;
const PANEL_H = 720;
const PAD = 64;
const GAP = 48;
const TOTAL_W = PANEL_W * 2 + GAP;

function pickHorizVertKm(p: VecKm, plane: EclipticPlane): { h: number; v: number } {
  switch (plane) {
    case "xy":
      return { h: p.x, v: p.y };
    case "xz":
      return { h: p.x, v: p.z };
    case "yz":
      return { h: p.y, v: p.z };
    default:
      return { h: p.x, v: p.y };
  }
}

/** Etiqueta eje en miles de km */
function fmtAxisK103(km: number): string {
  const k = km / 1000;
  if (!Number.isFinite(k)) return "—";
  const s = k.toFixed(0);
  return s === "-0" ? "0" : s;
}

function starField(seed: number, n: number, w: number, h: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const out: { cx: number; cy: number; r: number; o: number }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      cx: next() * w,
      cy: next() * h,
      r: next() * 1.1 + 0.35,
      o: next() * 0.55 + 0.25,
    });
  }
  return out;
}

type PanelProps = {
  uid: string;
  plane: EclipticPlane;
  offsetX: number;
  title: string;
  horizName: string;
  vertName: string;
  trajectoryKm: VecKm[];
  moonKm: VecKm;
  orionKm: VecKm;
  stars: { cx: number; cy: number; r: number; o: number }[];
};

function EclipticPlanePanel({
  uid,
  plane,
  offsetX,
  title,
  horizName,
  vertName,
  trajectoryKm,
  moonKm,
  orionKm,
  stars,
}: PanelProps) {
  const bounds = useMemo(
    () =>
      boundsFromTrajectory3D(trajectoryKm, moonKm, orionKm, plane),
    [trajectoryKm, moonKm, orionKm, plane]
  );

  const pathD = useMemo(() => {
    if (trajectoryKm.length < 2) return "";
    const parts: string[] = [];
    for (let i = 0; i < trajectoryKm.length; i++) {
      const { h, v } = pickHorizVertKm(trajectoryKm[i]!, plane);
      const { sx, sy } = projectKmToSvg(h, v, bounds, PANEL_W, PANEL_H, PAD);
      parts.push(`${i === 0 ? "M" : "L"} ${sx.toFixed(2)} ${sy.toFixed(2)}`);
    }
    return parts.join(" ");
  }, [trajectoryKm, bounds, plane]);

  const earth = projectKmToSvg(0, 0, bounds, PANEL_W, PANEL_H, PAD);
  const moon = (() => {
    const { h, v } = pickHorizVertKm(moonKm, plane);
    return projectKmToSvg(h, v, bounds, PANEL_W, PANEL_H, PAD);
  })();
  const orion = (() => {
    const { h, v } = pickHorizVertKm(orionKm, plane);
    return projectKmToSvg(h, v, bounds, PANEL_W, PANEL_H, PAD);
  })();

  const reKm =
    trajectoryKm.length > 0
      ? Math.max(
          ...trajectoryKm.map((p) => Math.hypot(p.x, p.y, p.z)),
          Math.hypot(moonKm.x, moonKm.y, moonKm.z),
          Math.hypot(orionKm.x, orionKm.y, orionKm.z)
        )
      : 400_000;

  const scalePx = PANEL_W * 0.52;
  let rEarthPx = Math.max(58, Math.min(108, (6378.137 / reKm) * scalePx));
  let rMoonPx = Math.max(28, Math.min(56, (1737.4 / reKm) * scalePx));
  if (rMoonPx >= rEarthPx * 0.85) rMoonPx = rEarthPx * 0.42;
  const rOrionPx = Math.max(36, Math.min(72, rEarthPx * 0.55));

  const labelEarthY = Math.min(PANEL_H - PAD + 22, earth.sy + rEarthPx + 22);
  const labelMoonY = Math.min(PANEL_H - PAD + 22, moon.sy + rMoonPx + 22);
  const labelOrionY = orion.sy + rOrionPx + 20;

  const clipId = `${uid}-view-${plane}`;
  const earthClip = `${uid}-earth-${plane}`;
  const moonClip = `${uid}-moon-${plane}`;
  const glowId = `${uid}-trail-glow-${plane}`;

  return (
    <g transform={`translate(${offsetX},0)`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={PANEL_W} height={PANEL_H} />
        </clipPath>
        <clipPath id={earthClip}>
          <circle cx={earth.sx} cy={earth.sy} r={rEarthPx} />
        </clipPath>
        <clipPath id={moonClip}>
          <circle cx={moon.sx} cy={moon.sy} r={rMoonPx} />
        </clipPath>
        <filter
          id={glowId}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="2.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={PANEL_W} height={PANEL_H} fill="#030508" />

      <g clipPath={`url(#${clipId})`}>
        {stars.map((st, i) => (
          <circle
            key={i}
            cx={st.cx}
            cy={st.cy}
            r={st.r}
            fill="#e2e8f0"
            opacity={st.o}
          />
        ))}

        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <g key={t}>
            <line
              x1={PAD + t * (PANEL_W - 2 * PAD)}
              y1={PAD}
              x2={PAD + t * (PANEL_W - 2 * PAD)}
              y2={PANEL_H - PAD}
              stroke="#1e3a5f"
              strokeWidth={0.65}
              opacity={0.55}
            />
            <line
              x1={PAD}
              y1={PAD + t * (PANEL_H - 2 * PAD)}
              x2={PANEL_W - PAD}
              y2={PAD + t * (PANEL_H - 2 * PAD)}
              stroke="#1e3a5f"
              strokeWidth={0.65}
              opacity={0.55}
            />
          </g>
        ))}

        {pathD ? (
          <>
            <path
              d={pathD}
              fill="none"
              stroke={TRAIL_UNDER}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.28}
            />
            <path
              d={pathD}
              fill="none"
              stroke={TRAIL_MAIN}
              strokeWidth={4.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${glowId})`}
              opacity={0.98}
            />
          </>
        ) : null}

        <image
          clipPath={`url(#${earthClip})`}
          href={IMG_EARTH}
          x={earth.sx - rEarthPx}
          y={earth.sy - rEarthPx}
          width={rEarthPx * 2}
          height={rEarthPx * 2}
          preserveAspectRatio="xMidYMid slice"
          className="select-none"
        />
        <circle
          cx={earth.sx}
          cy={earth.sy}
          r={rEarthPx}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
          opacity={0.45}
        />

        <image
          clipPath={`url(#${moonClip})`}
          href={IMG_MOON}
          x={moon.sx - rMoonPx}
          y={moon.sy - rMoonPx}
          width={rMoonPx * 2}
          height={rMoonPx * 2}
          preserveAspectRatio="xMidYMid slice"
          className="select-none"
        />

        <image
          href={IMG_ORION}
          x={orion.sx - rOrionPx}
          y={orion.sy - rOrionPx}
          width={rOrionPx * 2}
          height={rOrionPx * 2}
          preserveAspectRatio="xMidYMid meet"
          className="select-none"
        />

        <text
          x={earth.sx}
          y={labelEarthY}
          textAnchor="middle"
          fill="#7dd3fc"
          fontSize={15}
          fontWeight={600}
          fontFamily="var(--font-geist-sans, system-ui), sans-serif"
          letterSpacing="0.12em"
        >
          TIERRA
        </text>
        <text
          x={moon.sx}
          y={labelMoonY}
          textAnchor="middle"
          fill="#f1f5f9"
          fontSize={13}
          fontWeight={600}
          fontFamily="var(--font-geist-sans, system-ui), sans-serif"
          letterSpacing="0.1em"
        >
          LUNA
        </text>
        <text
          x={orion.sx}
          y={labelOrionY}
          textAnchor="middle"
          fill="#fbbf24"
          fontSize={14}
          fontWeight={700}
          fontFamily="var(--font-geist-sans, system-ui), sans-serif"
          letterSpacing="0.06em"
        >
          ORION
        </text>
        <text
          x={orion.sx}
          y={labelOrionY + 16}
          textAnchor="middle"
          fill="#fcd34d"
          fontSize={10}
          fontWeight={500}
          fontFamily="var(--font-geist-sans, system-ui), sans-serif"
          letterSpacing="0.2em"
          opacity={0.92}
        >
          INTEGRITY
        </text>
      </g>

      <text
        x={PAD}
        y={34}
        fill="#64748b"
        fontSize={12}
        fontFamily="var(--font-geist-sans, system-ui), sans-serif"
      >
        {title}
      </text>
      <text
        x={PANEL_W - PAD}
        y={34}
        textAnchor="end"
        fill="#475569"
        fontSize={11}
        fontFamily="var(--font-geist-mono, ui-monospace), monospace"
      >
        {horizName}: {fmtAxisK103(bounds.minX)} … {fmtAxisK103(bounds.maxX)} ×10³ km
      </text>
      <text
        x={PANEL_W - PAD}
        y={50}
        textAnchor="end"
        fill="#475569"
        fontSize={11}
        fontFamily="var(--font-geist-mono, ui-monospace), monospace"
      >
        {vertName}: {fmtAxisK103(bounds.minY)} … {fmtAxisK103(bounds.maxY)} ×10³ km
      </text>
    </g>
  );
}

export function OrbitSvg({
  orionKm,
  moonKm,
  trajectoryKm,
}: {
  orionKm: VecKm;
  moonKm: VecKm;
  trajectoryKm: VecKm[];
}) {
  const uid = useId().replace(/:/g, "");
  const stars = useMemo(
    () => starField(0x4f5242, 140, PANEL_W, PANEL_H),
    []
  );

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-inner">
      <p className="border-b border-zinc-800 bg-zinc-950/80 px-4 py-2 text-xs leading-relaxed text-zinc-400">
        Cada panel es una <strong className="font-medium text-zinc-300">proyección 2D</strong>{" "}
        de la eclíptica J2000 (km): izquierda plano <strong className="text-zinc-300">X–Y</strong>
        ; derecha <strong className="text-zinc-300">X–Z</strong> (componente fuera del plano
        X–Y). Los datos tienen las tres coordenadas; un solo gráfico no puede mostrar las tres
        a la vez sin perspectiva 3D.
      </p>
      <svg
        viewBox={`0 0 ${TOTAL_W} ${PANEL_H}`}
        className="block h-auto w-full max-h-[min(92vh,980px)] min-h-[320px]"
        role="img"
        aria-label="Trayectoria Orion: proyecciones eclípticas X–Y y X–Z"
      >
        <EclipticPlanePanel
          uid={uid}
          plane="xy"
          offsetX={0}
          title="Plano X–Y · eclíptica J2000 (km) · Tierra en origen"
          horizName="X"
          vertName="Y"
          trajectoryKm={trajectoryKm}
          moonKm={moonKm}
          orionKm={orionKm}
          stars={stars}
        />
        <EclipticPlanePanel
          uid={uid}
          plane="xz"
          offsetX={PANEL_W + GAP}
          title="Plano X–Z · misma escena (inclinación respecto al plano X–Y)"
          horizName="X"
          vertName="Z"
          trajectoryKm={trajectoryKm}
          moonKm={moonKm}
          orionKm={orionKm}
          stars={stars}
        />
      </svg>
    </div>
  );
}
