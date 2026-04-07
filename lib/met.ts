/** Artemis II — lanzamiento oficial (UTC) según Horizons / NASA. */
export const ARTEMIS_II_LAUNCH_UTC = new Date("2026-04-01T22:35:12.000Z");

/** Duración nominal de la misión (10 días). */
export const MISSION_NOMINAL_DAYS = 10;

export function metMsSinceLaunch(now: Date = new Date()): number {
  return now.getTime() - ARTEMIS_II_LAUNCH_UTC.getTime();
}

export function formatMet(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${sign}${days}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function missionProgressPercent(now: Date = new Date()): number {
  const total = MISSION_NOMINAL_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = metMsSinceLaunch(now);
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}
