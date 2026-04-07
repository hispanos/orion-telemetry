/**
 * Proyección de posiciones eclípticas J2000 (km) a coordenadas SVG.
 * Cada vista 2D usa solo **dos** componentes; la tercera es perpendicular al plano dibujado.
 */

export type BoundsKm = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type Vec2 = { x: number; y: number };

export type Vec3Km = { x: number; y: number; z: number };

/** Plano de la proyección: qué par de ejes eclípticos forman los ejes horizontal/vertical del SVG. */
export type EclipticPlane = "xy" | "xz" | "yz";

function pickPlane(p: Vec3Km, plane: EclipticPlane): Vec2 {
  switch (plane) {
    case "xy":
      return { x: p.x, y: p.y };
    case "xz":
      return { x: p.x, y: p.z };
    case "yz":
      return { x: p.y, y: p.z };
    default:
      return { x: p.x, y: p.y };
  }
}

/**
 * Rango mínimo por eje (km) para trayectorias cislunares: evita colapso cuando hay
 * un solo punto, datos aún no cargados (todo en 0) o rango numérico casi nulo.
 */
const MIN_AXIS_SPAN_KM = 500_000;

function expandBounds(
  points: Vec2[],
  padRatio = 0.045
): BoundsKm {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  minX = Math.min(minX, 0);
  maxX = Math.max(maxX, 0);
  minY = Math.min(minY, 0);
  maxY = Math.max(maxY, 0);

  let dx = maxX - minX;
  let dy = maxY - minY;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  if (dx < MIN_AXIS_SPAN_KM) {
    minX = cx - MIN_AXIS_SPAN_KM / 2;
    maxX = cx + MIN_AXIS_SPAN_KM / 2;
    dx = MIN_AXIS_SPAN_KM;
  }
  if (dy < MIN_AXIS_SPAN_KM) {
    minY = cy - MIN_AXIS_SPAN_KM / 2;
    maxY = cy + MIN_AXIS_SPAN_KM / 2;
    dy = MIN_AXIS_SPAN_KM;
  }

  const px = dx * padRatio;
  const py = dy * padRatio;
  return {
    minX: minX - px,
    maxX: maxX + px,
    minY: minY - py,
    maxY: maxY + py,
  };
}

export function boundsFromTrajectory(
  trajectoryKm: Vec2[],
  moonKm: Vec2,
  orionKm: Vec2
): BoundsKm {
  const pts = [
    ...trajectoryKm,
    moonKm,
    orionKm,
    { x: 0, y: 0 },
  ];
  return expandBounds(pts);
}

/** Límites para un plano eclíptico concreto (p. ej. X–Z para ver inclinación fuera del plano X–Y). */
export function boundsFromTrajectory3D(
  trajectoryKm: Vec3Km[],
  moonKm: Vec3Km,
  orionKm: Vec3Km,
  plane: EclipticPlane
): BoundsKm {
  const origin2 = pickPlane({ x: 0, y: 0, z: 0 }, plane);
  const pts = [
    ...trajectoryKm.map((p) => pickPlane(p, plane)),
    pickPlane(moonKm, plane),
    pickPlane(orionKm, plane),
    origin2,
  ];
  return expandBounds(pts);
}

export function projectKmToSvg(
  xKm: number,
  yKm: number,
  b: BoundsKm,
  width: number,
  height: number,
  padding: number
): { sx: number; sy: number } {
  const iw = width - 2 * padding;
  const ih = height - 2 * padding;
  const rx = b.maxX - b.minX || 1;
  const ry = b.maxY - b.minY || 1;
  const sx = padding + ((xKm - b.minX) / rx) * iw;
  const sy = padding + ((b.maxY - yKm) / ry) * ih;
  return { sx, sy };
}
