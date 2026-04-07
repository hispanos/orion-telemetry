/**
 * Primer instante con ephemeris Orion (−1024) en Horizons para este objetivo: la API no
 * devuelve bloque $$SOE si START cae antes de ~2026-Apr-02 01:58 TDB (post-separación ICPS).
 * Usar solo día `2026-Apr-02` como START sigue fallando (Horizons lo toma como 00:00 UTC).
 */
export const HORIZONS_DEFAULT_START = "2026-Apr-02 02:00:00";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Formato calendario Horizons: `YYYY-Mmm-DD` (día UTC). */
export function formatHorizonsCalendarDate(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = MONTHS[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Inicio del día de lanzamiento nominal (1 abr 2026, 00:00 UTC). */
const LAUNCH_DAY_START_UTC = startOfUtcDay(new Date(Date.UTC(2026, 3, 1)));

/**
 * STOP_TIME por defecto: **día calendario actual en UTC**.
 * Si hoy es anterior o igual al día de lanzamiento, el STOP debe quedar **después** de
 * {@link HORIZONS_DEFAULT_START} (2026-Apr-02 02:00 UTC); `2026-Apr-02` solo sería inválido.
 */
export function horizonsDefaultStopUtc(now: Date = new Date()): string {
  const today = startOfUtcDay(now);
  if (today.getTime() < LAUNCH_DAY_START_UTC.getTime()) {
    return "2026-Apr-03";
  }
  if (today.getTime() === LAUNCH_DAY_START_UTC.getTime()) {
    return "2026-Apr-03";
  }
  return formatHorizonsCalendarDate(now);
}

/** Paso moderado para varios días sin saturar la respuesta ni el SVG. */
export const HORIZONS_DEFAULT_STEP = "15m";
