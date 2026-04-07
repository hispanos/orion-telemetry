/** Conversión aproximada entre fecha JS y día juliano (UT). */

export function dateToJulianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Inversa de {@link dateToJulianDay} (epoch JS ↔ JD civil). */
export function julianDayToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
