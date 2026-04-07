import { NextResponse } from "next/server";
import {
  HORIZONS_DEFAULT_START,
  HORIZONS_DEFAULT_STEP,
  horizonsDefaultStopUtc,
} from "@/lib/horizons-defaults";
import {
  alignByJd,
  altitudeAboveEquatorKm,
  distanceBetweenKm,
  magnitudeKm,
  parseHorizonsResult,
  speedKmPerS,
} from "@/lib/horizons-parse";

const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";

/** Radio medio lunar para distancia superficie–superficie (aprox.). */
const MOON_MEAN_RADIUS_KM = 1737.4;

type HorizonsJson = { result?: string; signature?: unknown };

function buildParams(command: string, start: string, stop: string, step: string) {
  const p = new URLSearchParams();
  p.set("format", "json");
  p.set("COMMAND", `'${command}'`);
  p.set("MAKE_EPHEM", "'YES'");
  p.set("EPHEM_TYPE", "'VECTORS'");
  p.set("CENTER", "'500@399'");
  p.set("START_TIME", `'${start}'`);
  p.set("STOP_TIME", `'${stop}'`);
  p.set("STEP_SIZE", `'${step}'`);
  p.set("VEC_TABLE", "'1'");
  p.set("CSV_FORMAT", "'YES'");
  return p;
}

async function fetchHorizonsBody(command: string, start: string, stop: string, step: string) {
  const url = `${HORIZONS_URL}?${buildParams(command, start, stop, step).toString()}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`Horizons HTTP ${res.status}`);
  }
  const data = (await res.json()) as HorizonsJson;
  const text = data.result ?? "";
  if (!text || text.includes("error")) {
    throw new Error("Respuesta Horizons inválida o sin ephemeris");
  }
  return parseHorizonsResult(text);
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start") ?? HORIZONS_DEFAULT_START;
  const stop = searchParams.get("stop") ?? horizonsDefaultStopUtc();
  const step = searchParams.get("step") ?? HORIZONS_DEFAULT_STEP;

  try {
    const [orionParsed, moonParsed] = await Promise.all([
      fetchHorizonsBody("-1024", start, stop, step),
      fetchHorizonsBody("301", start, stop, step),
    ]);

    const earthR = orionParsed.centerRadiiKm.equatorA;
    if (orionParsed.samples.length === 0) {
      throw new Error(
        "Orion (−1024): sin ephemeris en este rango. Horizons suele exigir START ≥ ~2026-Apr-02 02:00 UTC (tras ICPS); `2026-Apr-01` o `2026-Apr-02` a medianoche devuelve 0 puntos."
      );
    }
    const pairs = alignByJd(orionParsed.samples, moonParsed.samples);
    if (pairs.length === 0) {
      throw new Error(
        "No se pudieron alinear Orion y Luna por JD (longitudes distintas o rejilla distinta). Revisa START/STOP/STEP."
      );
    }

    const samples = pairs.map(({ a: o, b: m }, i) => {
      const prev = pairs[i - 1]?.a;
      const next = pairs[i + 1]?.a;
      const distEarthCenter = magnitudeKm(o);
      const altitudeKm = altitudeAboveEquatorKm(o, earthR);
      const distMoonCenter = distanceBetweenKm(o, m);
      const distMoonSurface = Math.max(0, distMoonCenter - MOON_MEAN_RADIUS_KM);
      const speed = speedKmPerS(prev, o, next);

      return {
        jd: o.jd,
        calendar: o.calendar,
        orionKm: { x: o.xKm, y: o.yKm, z: o.zKm },
        moonKm: { x: m.xKm, y: m.yKm, z: m.zKm },
        distEarthCenterKm: distEarthCenter,
        altitudeKm,
        distMoonCenterKm: distMoonCenter,
        distMoonSurfaceKm: distMoonSurface,
        speedKmS: speed,
      };
    });

    return NextResponse.json({
      meta: {
        frame: "Ecliptic J2000, centro Tierra (500@399), estados geométricos",
        earthEquatorRadiusKm: earthR,
        moonMeanRadiusKm: MOON_MEAN_RADIUS_KM,
        start,
        stop,
        step,
      },
      samples,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
