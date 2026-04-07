"use client";

import { useId, useMemo } from "react";
import { boundsFromTrajectory, projectKmToSvg } from "@/lib/svg-orbit";

type VecKm = { x: number; y: number; z: number };

const IMG_EARTH = "/textures/earth.jpg";
const IMG_MOON = "/textures/moon.jpg";
const IMG_ORION = "/textures/orion.jpg";

/** Trayectoria (distinto del verde del cartel de referencia; violeta legible sobre negro). */
const TRAIL_UNDER = "#6d28d9";
const TRAIL_MAIN = "#c084fc";

/** Lienzo panorámico (similar a diagramas de trayectoria tipo NASA). */
const W = 1680;
const H = 720;
const PAD = 64;

/** Etiqueta eje en miles de km; evita "-0" y rangos ilegibles tipo "-120--118". */
function fmtAxisK103(km: number): string {
  const k = km / 1000;
  if (!Number.isFinite(k)) return "—";
  const s = k.toFixed(0);
  return s === "-0" ? "0" : s;
}

/** Posiciones de “estrellas” fijas (deterministas) para fondo espacial. */
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
  const stars = useMemo(() => starField(0x4f5242, 140, W, H), []);

  const bounds = useMemo(
    () =>
      boundsFromTrajectory(
        trajectoryKm.map((p) => ({ x: p.x, y: p.y })),
        { x: moonKm.x, y: moonKm.y },
        { x: orionKm.x, y: orionKm.y }
      ),
    [trajectoryKm, moonKm, orionKm]
  );

  const pathD = useMemo(() => {
    if (trajectoryKm.length < 2) return "";
    const parts: string[] = [];
    for (let i = 0; i < trajectoryKm.length; i++) {
      const { sx, sy } = projectKmToSvg(
        trajectoryKm[i].x,
        trajectoryKm[i].y,
        bounds,
        W,
        H,
        PAD
      );
      parts.push(`${i === 0 ? "M" : "L"} ${sx.toFixed(2)} ${sy.toFixed(2)}`);
    }
    return parts.join(" ");
  }, [trajectoryKm, bounds]);

  const earth = projectKmToSvg(0, 0, bounds, W, H, PAD);
  const moon = projectKmToSvg(moonKm.x, moonKm.y, bounds, W, H, PAD);
  const orion = projectKmToSvg(orionKm.x, orionKm.y, bounds, W, H, PAD);

  const reKm =
    trajectoryKm.length > 0
      ? Math.max(
          ...trajectoryKm.map((p) => Math.hypot(p.x, p.y, p.z)),
          Math.hypot(moonKm.x, moonKm.y, moonKm.z),
          Math.hypot(orionKm.x, orionKm.y, orionKm.z)
        )
      : 400_000;

  /**
   * Radios en px más generosos que la escala física pura: en pantalla la Tierra/Luna
   * quedaban diminutas; aquí se acerca a diagramas tipo infografía (Tierra claramente mayor que Luna).
   */
  const scalePx = W * 0.52;
  let rEarthPx = Math.max(58, Math.min(108, (6378.137 / reKm) * scalePx));
  let rMoonPx = Math.max(28, Math.min(56, (1737.4 / reKm) * scalePx));
  if (rMoonPx >= rEarthPx * 0.85) rMoonPx = rEarthPx * 0.42;
  const rOrionPx = Math.max(36, Math.min(72, rEarthPx * 0.55));

  const labelEarthY = Math.min(H - PAD + 22, earth.sy + rEarthPx + 22);
  const labelMoonY = Math.min(H - PAD + 22, moon.sy + rMoonPx + 22);
  const labelOrionY = orion.sy + rOrionPx + 20;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-inner">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full max-h-[min(92vh,980px)] min-h-[320px]"
        role="img"
        aria-label="Trayectoria Orion: plano X–Y eclíptica J2000"
      >
        <defs>
          <clipPath id={`${uid}-view`}>
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
          <clipPath id={`${uid}-earth`}>
            <circle cx={earth.sx} cy={earth.sy} r={rEarthPx} />
          </clipPath>
          <clipPath id={`${uid}-moon`}>
            <circle cx={moon.sx} cy={moon.sy} r={rMoonPx} />
          </clipPath>
          <filter
            id={`${uid}-trail-glow`}
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

        <rect width={W} height={H} fill="#030508" />

        <g clipPath={`url(#${uid}-view)`}>
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

          {/* Cuadrícula tipo consola de misión */}
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
            <g key={t}>
              <line
                x1={PAD + t * (W - 2 * PAD)}
                y1={PAD}
                x2={PAD + t * (W - 2 * PAD)}
                y2={H - PAD}
                stroke="#1e3a5f"
                strokeWidth={0.65}
                opacity={0.55}
              />
              <line
                x1={PAD}
                y1={PAD + t * (H - 2 * PAD)}
                x2={W - PAD}
                y2={PAD + t * (H - 2 * PAD)}
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
                filter={`url(#${uid}-trail-glow)`}
                opacity={0.98}
              />
            </>
          ) : null}

          {/* Tierra */}
          <image
            clipPath={`url(#${uid}-earth)`}
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

          {/* Luna */}
          <image
            clipPath={`url(#${uid}-moon)`}
            href={IMG_MOON}
            x={moon.sx - rMoonPx}
            y={moon.sy - rMoonPx}
            width={rMoonPx * 2}
            height={rMoonPx * 2}
            preserveAspectRatio="xMidYMid slice"
            className="select-none"
          />

          {/* Orion */}
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
          Plano X–Y · eclíptica J2000 (km) · Tierra en origen
        </text>
        <text
          x={W - PAD}
          y={34}
          textAnchor="end"
          fill="#475569"
          fontSize={11}
          fontFamily="var(--font-geist-mono, ui-monospace), monospace"
        >
          X: {fmtAxisK103(bounds.minX)} … {fmtAxisK103(bounds.maxX)} ×10³ km
        </text>
        <text
          x={W - PAD}
          y={50}
          textAnchor="end"
          fill="#475569"
          fontSize={11}
          fontFamily="var(--font-geist-mono, ui-monospace), monospace"
        >
          Y: {fmtAxisK103(bounds.minY)} … {fmtAxisK103(bounds.maxY)} ×10³ km
        </text>
      </svg>
    </div>
  );
}
