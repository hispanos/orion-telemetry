/** Hitos principales (fechas UTC de la planificación NASA / Horizons). */
export type Milestone = {
  id: string;
  label: string;
  /** UTC cuando el evento debe considerarse ya ocurrido */
  occursAtUtc: string;
};

export const ARTEMIS_II_MILESTONES: Milestone[] = [
  {
    id: "launch",
    label: "Lanzamiento (LC-39B)",
    occursAtUtc: "2026-04-01T22:24:00.000Z",
  },
  {
    id: "solar_arrays",
    label: "Despliegue de paneles solares",
    occursAtUtc: "2026-04-01T22:44:00.000Z",
  },
  {
    id: "tli",
    label: "Fin de la quema TLI (Translunar Injection)",
    occursAtUtc: "2026-04-02T23:54:00.000Z",
  },
  {
    id: "otc3",
    label: "Corrección de trayectoria OTC-3",
    occursAtUtc: "2026-04-06T03:03:35.000Z",
  },
  {
    id: "lunar_soi",
    label: "Entrada en SOI lunar",
    occursAtUtc: "2026-04-06T05:38:44.000Z",
  },
  {
    id: "lunar_flyby",
    label: "Máxima aproximación a la Luna (~8282 km)",
    occursAtUtc: "2026-04-06T23:01:00.000Z",
  },
  {
    id: "exit_lunar_soi",
    label: "Salida de la esfera de influencia lunar",
    occursAtUtc: "2026-04-07T17:27:00.000Z",
  },
  {
    id: "entry_interface",
    label: "Interfaz de entrada (122 km)",
    occursAtUtc: "2026-04-11T00:04:00.000Z",
  },
  {
    id: "splashdown",
    label: "Amerizaje (Pacífico)",
    occursAtUtc: "2026-04-11T00:17:00.000Z",
  },
];

export function isMilestoneComplete(
  milestone: Milestone,
  now: Date = new Date()
): boolean {
  return now.getTime() >= new Date(milestone.occursAtUtc).getTime();
}
