"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OrbitScene3D } from "@/components/OrbitScene3D";
import type { EphemerisApiResponse } from "@/lib/ephemeris-types";
import {
  HORIZONS_DEFAULT_START,
  HORIZONS_DEFAULT_STEP,
  horizonsDefaultStopUtc,
} from "@/lib/horizons-defaults";
import { interpolateSampleAtJd } from "@/lib/interpolate-ephemeris";
import { dateToJulianDay, julianDayToDate } from "@/lib/jd";
import {
  formatMet,
  metMsSinceLaunch,
  missionProgressPercent,
  ARTEMIS_II_LAUNCH_UTC,
} from "@/lib/met";
import { ARTEMIS_II_MILESTONES, isMilestoneComplete } from "@/lib/milestones";
import type { EphemerisApiSample } from "@/lib/ephemeris-types";

function formatKm(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (Math.abs(km) >= 1e6) return `${(km / 1e6).toFixed(3)} millones km`;
  if (Math.abs(km) >= 1000) return `${(km / 1000).toFixed(3)} miles km`;
  return `${km.toFixed(1)} km`;
}

function formatSpeed(kmS: number): string {
  if (!Number.isFinite(kmS)) return "—";
  return `${kmS.toFixed(3)} km/s`;
}

function formatUtcFromJd(jd: number): string {
  return julianDayToDate(jd).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

const SLIDER_STEPS = 10_000;

export default function ArtemisDashboard() {
  /** null hasta montar en el cliente: evita hydration mismatch (MET/reloj vs SSR). */
  const [now, setNow] = useState<Date | null>(null);
  const [start, setStart] = useState(HORIZONS_DEFAULT_START);
  const [stop, setStop] = useState(() => horizonsDefaultStopUtc());
  const [step, setStep] = useState(HORIZONS_DEFAULT_STEP);
  const [data, setData] = useState<EphemerisApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Si es true, el instante mostrado sigue el reloj del cliente; si false, el slider. */
  const [followRealTime, setFollowRealTime] = useState(true);
  /** Posición normalizada 0…1 dentro del intervalo de muestras (solo en modo scrub). */
  const [scrubT, setScrubT] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ start, stop, step });
      const res = await fetch(`/api/horizons?${q.toString()}`);
      const json = (await res.json()) as EphemerisApiResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Error al cargar ephemeris");
      }
      setData(json);
      setFollowRealTime(true);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [start, stop, step]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const jdNow = now ? dateToJulianDay(now) : 0;

  const jdBounds = useMemo(() => {
    if (!data?.samples.length) return null;
    const first = data.samples[0]!;
    const last = data.samples[data.samples.length - 1]!;
    const spanRaw = last.jd - first.jd;
    const span = spanRaw > 0 ? spanRaw : Number.EPSILON;
    return { min: first.jd, max: last.jd, span };
  }, [data]);

  const sliderT = useMemo(() => {
    if (!jdBounds || now == null) return scrubT;
    if (!followRealTime) return scrubT;
    const t = (jdNow - jdBounds.min) / jdBounds.span;
    return Math.min(1, Math.max(0, t));
  }, [jdBounds, now, followRealTime, scrubT, jdNow]);

  const jdPlayhead = useMemo(() => {
    if (!jdBounds) return null;
    if (followRealTime && now != null) return jdNow;
    return jdBounds.min + scrubT * jdBounds.span;
  }, [jdBounds, followRealTime, now, scrubT, jdNow]);

  const atPlayhead = useMemo(() => {
    if (!data?.samples.length || jdPlayhead == null) return null;
    return interpolateSampleAtJd(
      data.samples,
      jdPlayhead,
      data.meta.earthEquatorRadiusKm,
      data.meta.moonMeanRadiusKm
    );
  }, [data, jdPlayhead]);

  const metMs = now ? metMsSinceLaunch(now) : 0;
  const progress = now ? missionProgressPercent(now) : 0;

  /** Mientras no hay reloj ni playhead, usar última muestra para no dibujar en (0,0). */
  const lastSample = data?.samples?.length ? data.samples[data.samples.length - 1] : null;
  const vizOrionKm =
    atPlayhead?.orionKm ?? lastSample?.orionKm ?? { x: 0, y: 0, z: 0 };
  const vizMoonKm =
    atPlayhead?.moonKm ?? lastSample?.moonKm ?? { x: 0, y: 0, z: 0 };

  const trajectoryKm = useMemo(
    () => data?.samples.map((s) => s.orionKm) ?? [],
    [data]
  );

  /** Luna en la muestra central: encuadre 3D estable al usar el slider (no recalcula el foco). */
  const moonKmForBounds = useMemo(() => {
    const s = data?.samples;
    if (!s?.length) return { x: 0, y: 0, z: 0 };
    return s[Math.floor(s.length / 2)]!.moonKm;
  }, [data]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-3 border-b border-zinc-800 pb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400">
            NASA · JPL Horizons · Artemis II / Orion (−1024)
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Telemetría y trayectoria
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
            Posiciones geométricas (sin aberración) en eclíptica J2000 respecto al
            centro de la Tierra. Altitud = |r| − radio ecuatorio tomado de la
            respuesta Horizons. MET desde lanzamiento{" "}
            <time dateTime={ARTEMIS_II_LAUNCH_UTC.toISOString()}>
              1 abr 2026, 22:35:12 UTC
            </time>
            .
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              MET (Mission Elapsed Time)
            </p>
            <p className="mt-2 font-mono text-2xl text-sky-300">
              {now ? formatMet(metMs) : "—"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Negativo = antes del lanzamiento nominal
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Progreso misión (10 días nominales)
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-600 to-emerald-500 transition-[width] duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-lg text-emerald-300">
              {now ? `${progress.toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Ephemeris Horizons
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              {loading ? "Cargando…" : error ?? "Sincronizado"}
            </p>
            {atPlayhead != null && (
              <p className="mt-2 font-mono text-xs text-zinc-500">
                JD ≈ {jdPlayhead!.toFixed(6)}
                {!followRealTime && (
                  <span className="text-amber-400/90"> · instante manual</span>
                )}
              </p>
            )}
            {atPlayhead && (
              <p className="mt-1 font-mono text-[11px] text-zinc-600">
                {formatUtcFromJd(jdPlayhead!)} · {atPlayhead.calendar}
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <div className="flex w-full flex-col gap-4">
            <OrbitScene3D
              orionKm={vizOrionKm}
              moonKm={vizMoonKm}
              moonKmForBounds={moonKmForBounds}
              trajectoryKm={trajectoryKm}
            >
              {data?.samples.length && jdBounds ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <p className="text-sm font-semibold tracking-wide text-violet-300">
                        Línea de tiempo · recorre la misión
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        <span className="font-medium text-violet-200/90">
                          Prueba el control de abajo:
                        </span>{" "}
                        mueve el instante del intervalo cargado; Orion y la Luna se
                        actualizan en 3D y{" "}
                        <span className="text-zinc-300">
                          la cámara mantiene el ángulo que hayas elegido
                        </span>{" "}
                        (orbita con el ratón y luego arrastra el slider).
                      </p>
                      <p className="mt-2 font-mono text-sm text-sky-300">
                        {formatUtcFromJd(jdPlayhead ?? jdBounds.min)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {followRealTime
                          ? "Modo: hora UTC del navegador (interpolado en el intervalo)."
                          : "Modo: instante manual — vuelve al reloj con el botón."}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={followRealTime}
                      onClick={() => setFollowRealTime(true)}
                      className="shrink-0 rounded-xl border border-sky-600/70 bg-sky-950/70 px-4 py-2.5 text-sm font-medium text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.12)] transition hover:border-sky-500 hover:bg-sky-900/70 disabled:pointer-events-none disabled:opacity-35"
                    >
                      Seguir tiempo UTC
                    </button>
                  </div>
                  <label className="block rounded-xl border border-violet-500/25 bg-zinc-900/60 px-3 py-3">
                    <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-violet-400/90">
                      Instante en la ephemeris (arrastra)
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={SLIDER_STEPS}
                      step={1}
                      value={Math.round(sliderT * SLIDER_STEPS)}
                      onChange={(e) => {
                        setFollowRealTime(false);
                        setScrubT(Number(e.target.value) / SLIDER_STEPS);
                      }}
                      className="h-3 w-full cursor-pointer appearance-none rounded-full bg-zinc-800/90 accent-violet-500 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-200/80 [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:shadow-[0_0_14px_rgba(167,139,250,0.55)] active:[&::-webkit-slider-thumb]:cursor-grabbing"
                      aria-valuemin={0}
                      aria-valuemax={SLIDER_STEPS}
                      aria-valuenow={Math.round(sliderT * SLIDER_STEPS)}
                      aria-label="Instante en la trayectoria (intervalo de muestras Horizons)"
                    />
                    <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-500">
                      <span>Inicio muestras</span>
                      <span>Fin muestras</span>
                    </div>
                  </label>
                </div>
              ) : null}
            </OrbitScene3D>

            <p className="text-xs text-zinc-500">
              Vista 3D (Three.js): eclíptica J2000 respecto al centro Tierra; plano
              eclíptico en horizontal (X/Z) y componente fuera del plano en Y. Trayectoria
              violeta. Texturas{" "}
              <code className="text-zinc-400">/textures/earth.jpg</code> y{" "}
              <code className="text-zinc-400">/textures/moon.jpg</code>; Orion es un modelo
              geométrico procedural (sin textura). Arrastra con el ratón para orbitar la
              cámara.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Rango de datos (API)
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Por defecto: inicio{" "}
                  <strong className="font-normal text-zinc-400">
                    2026-Apr-02 02:00:00 UTC
                  </strong>{" "}
                  (Horizons no publica Orion antes de ~esa marca TDB); fin el{" "}
                  <strong className="font-normal text-zinc-400">
                    día actual UTC
                  </strong>
                  ; paso 15 m. Puedes bajar el paso (p. ej. 1 m) en intervalos cortos.
                </p>
                <div className="mt-4 grid gap-3 text-sm">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">START_TIME</span>
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sky-200 outline-none focus:border-sky-500"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">STOP_TIME</span>
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sky-200 outline-none focus:border-sky-500"
                      value={stop}
                      onChange={(e) => setStop(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">STEP_SIZE</span>
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sky-200 outline-none focus:border-sky-500"
                      value={step}
                      onChange={(e) => setStep(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-1 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
                  >
                    Actualizar ephemeris
                  </button>
                </div>
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <DistancePanel live={atPlayhead} />

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h2 className="text-sm font-semibold text-zinc-200">Hitos</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {ARTEMIS_II_MILESTONES.map((m) => {
                    const done = now ? isMilestoneComplete(m, now) : false;
                    return (
                      <li
                        key={m.id}
                        className="flex gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2"
                      >
                        <span className="select-none text-lg" aria-hidden>
                          {done ? "✅" : "⬜"}
                        </span>
                        <div>
                          <p className="font-medium text-zinc-100">{m.label}</p>
                          <p className="text-xs text-zinc-500">
                            {new Date(m.occursAtUtc).toUTCString()}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </aside>
          </div>
        </section>

        <footer className="border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Datos:{" "}
          <a
            className="text-sky-500 hover:underline"
            href="https://ssd.jpl.nasa.gov/api/horizons.api"
            target="_blank"
            rel="noreferrer"
          >
            NASA/JPL Horizons API
          </a>
          . Uso educativo; tiempos MET y hitos según planificación de misión
          publicada.
        </footer>
      </div>
    </div>
  );
}

function DistancePanel({ live }: { live: EphemerisApiSample | null }) {
  if (!live) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/20 p-5 text-sm text-zinc-500">
        Sin muestras en el intervalo seleccionado (ajusta fechas o espera la
        carga).
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="text-sm font-semibold text-zinc-200">
        Distancias y velocidad
      </h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-2">
          <dt className="text-zinc-500">Centro Tierra → Orion</dt>
          <dd className="font-mono text-sky-200">
            {formatKm(live.distEarthCenterKm)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-2">
          <dt className="text-zinc-500">Altitud sobre esferoide (Re)</dt>
          <dd className="font-mono text-emerald-200">
            {formatKm(live.altitudeKm)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-2">
          <dt className="text-zinc-500">Centro Luna → Orion</dt>
          <dd className="font-mono text-amber-200">
            {formatKm(live.distMoonCenterKm)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-2">
          <dt className="text-zinc-500">Superficie lunar → Orion (aprox.)</dt>
          <dd className="font-mono text-amber-100">
            {formatKm(live.distMoonSurfaceKm)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Velocidad (|Δr/Δt|, muestras API)</dt>
          <dd className="font-mono text-fuchsia-200">
            {formatSpeed(live.speedKmS)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
