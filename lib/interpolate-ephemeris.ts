import type { EphemerisApiSample } from "@/lib/ephemeris-types";
import { lerp } from "@/lib/jd";

function interpVec(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  t: number
) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function magKm(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Estado interpolado en el instante `jd` (TDB aproximado). */
export function interpolateSampleAtJd(
  samples: EphemerisApiSample[],
  jd: number,
  earthEquatorRadiusKm: number,
  moonMeanRadiusKm: number
): EphemerisApiSample | null {
  if (samples.length === 0) return null;
  if (jd <= samples[0].jd) return samples[0];
  const last = samples[samples.length - 1];
  if (jd >= last.jd) return last;

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (jd >= a.jd && jd <= b.jd) {
      const t = (jd - a.jd) / (b.jd - a.jd);
      const orionKm = interpVec(a.orionKm, b.orionKm, t);
      const moonKm = interpVec(a.moonKm, b.moonKm, t);
      const distEarthCenterKm = magKm(orionKm);
      const altitudeKm = distEarthCenterKm - earthEquatorRadiusKm;
      const dx = orionKm.x - moonKm.x;
      const dy = orionKm.y - moonKm.y;
      const dz = orionKm.z - moonKm.z;
      const distMoonCenterKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const distMoonSurfaceKm = Math.max(0, distMoonCenterKm - moonMeanRadiusKm);
      const speedKmS = lerp(a.speedKmS, b.speedKmS, t);

      return {
        jd,
        calendar: a.calendar,
        orionKm,
        moonKm,
        distEarthCenterKm,
        altitudeKm,
        distMoonCenterKm,
        distMoonSurfaceKm,
        speedKmS,
      };
    }
  }

  return last;
}
