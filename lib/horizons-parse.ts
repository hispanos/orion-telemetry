/** Parse NASA JPL Horizons API `result` text (VECTORS, CSV, geometric). */

export type HorizonsSample = {
  jd: number;
  calendar: string;
  xKm: number;
  yKm: number;
  zKm: number;
};

export type ParsedHorizons = {
  centerRadiiKm: { equatorA: number; equatorB: number; poleC: number };
  samples: HorizonsSample[];
};

const CENTER_RADII_RE =
  /Center radii\s*:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*km/i;

export function parseHorizonsResult(result: string): ParsedHorizons {
  const radiiMatch = result.match(CENTER_RADII_RE);
  const centerRadiiKm = radiiMatch
    ? {
        equatorA: Number(radiiMatch[1]),
        equatorB: Number(radiiMatch[2]),
        poleC: Number(radiiMatch[3]),
      }
    : { equatorA: 6378.137, equatorB: 6378.137, poleC: 6356.752 };

  const soe = result.indexOf("$$SOE");
  const eoe = result.indexOf("$$EOE");
  if (soe === -1 || eoe === -1 || eoe <= soe) {
    return { centerRadiiKm, samples: [] };
  }

  const block = result.slice(soe + 5, eoe);
  const lines = block.split(/\r?\n/);
  const samples: HorizonsSample[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("JDTDB") || trimmed.startsWith("*")) {
      continue;
    }
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length < 5) continue;

    const jd = Number(parts[0]);
    if (!Number.isFinite(jd)) continue;

    const xKm = Number(parts[2]);
    const yKm = Number(parts[3]);
    const zKm = Number(parts[4]);
    if (![xKm, yKm, zKm].every(Number.isFinite)) continue;

    samples.push({
      jd,
      calendar: parts[1] ?? "",
      xKm,
      yKm,
      zKm,
    });
  }

  return { centerRadiiKm, samples };
}

export function magnitudeKm(s: HorizonsSample): number {
  const { xKm, yKm, zKm } = s;
  return Math.sqrt(xKm * xKm + yKm * yKm + zKm * zKm);
}

/** Altitud sobre el elipsoide esférico (usa radio ecuatorial a). */
export function altitudeAboveEquatorKm(
  s: HorizonsSample,
  earthEquatorRadiusKm: number
): number {
  return magnitudeKm(s) - earthEquatorRadiusKm;
}

export function speedKmPerS(
  prev: HorizonsSample | undefined,
  curr: HorizonsSample,
  next: HorizonsSample | undefined
): number {
  if (prev && next) {
    const dtPrev = (curr.jd - prev.jd) * 86400;
    const dtNext = (next.jd - curr.jd) * 86400;
    if (dtPrev > 0 && dtNext > 0) {
      const vx =
        ((curr.xKm - prev.xKm) / dtPrev + (next.xKm - curr.xKm) / dtNext) / 2;
      const vy =
        ((curr.yKm - prev.yKm) / dtPrev + (next.yKm - curr.yKm) / dtNext) / 2;
      const vz =
        ((curr.zKm - prev.zKm) / dtPrev + (next.zKm - curr.zKm) / dtNext) / 2;
      return Math.sqrt(vx * vx + vy * vy + vz * vz);
    }
  }
  if (prev) {
    const dt = (curr.jd - prev.jd) * 86400;
    if (dt <= 0) return 0;
    const dx = curr.xKm - prev.xKm;
    const dy = curr.yKm - prev.yKm;
    const dz = curr.zKm - prev.zKm;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
  }
  if (next) {
    const dt = (next.jd - curr.jd) * 86400;
    if (dt <= 0) return 0;
    const dx = next.xKm - curr.xKm;
    const dy = next.yKm - curr.yKm;
    const dz = next.zKm - curr.zKm;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
  }
  return 0;
}

export function distanceBetweenKm(a: HorizonsSample, b: HorizonsSample): number {
  const dx = a.xKm - b.xKm;
  const dy = a.yKm - b.yKm;
  const dz = a.zKm - b.zKm;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Alinea dos series por JD (intersección).
 * Mismo START/STOP/STEP en Horizons → misma longitud: emparejar por índice (evita 0 pares
 * cuando `toFixed(8)` en JD no coincide por precisión de float).
 */
export function alignByJd<T extends { jd: number }>(
  a: T[],
  b: T[]
): { a: T; b: T }[] {
  if (a.length === b.length && a.length > 0) {
    return a.map((ai, i) => ({ a: ai, b: b[i]! }));
  }

  const mapB = new Map(b.map((s) => [s.jd.toFixed(8), s]));
  const out: { a: T; b: T }[] = [];
  for (const sa of a) {
    const sb = mapB.get(sa.jd.toFixed(8));
    if (sb) out.push({ a: sa, b: sb });
  }
  return out;
}
