# Artemis · trayectoria Orion

Aplicación web que **visualiza la misión Artemis II** usando **ephemeris geométricas** de la NASA: posiciones de **Orion** (−1024) y de la **Luna** (301) respecto al **centro de la Tierra**, en marco **eclíptico J2000**, obtenidas con la **API JPL Horizons**.

Sirve como panel de práctica: telemetría derivada (altitud, distancia a la Luna, velocidad), **reloj MET** respecto al lanzamiento nominal, progreso de la ventana de misión y **dos vistas orbitales** (SVG panorámica y escena 3D interactiva) con control de tiempo (hora del navegador o slider sobre el intervalo cargado).

## Tecnologías

| Área | Stack |
|------|--------|
| Framework | [Next.js](https://nextjs.org) 16 (App Router) |
| UI | [React](https://react.dev) 19, [TypeScript](https://www.typescriptlang.org) |
| Estilos | [Tailwind CSS](https://tailwindcss.com) 4 |
| 3D | [Three.js](https://threejs.org), [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction), [@react-three/drei](https://github.com/pmndrs/drei) |
| Datos | Ruta API propia (`/api/horizons`) que consulta `https://ssd.jpl.nasa.gov/api/horizons.api` |

## Requisitos

- Node.js compatible con Next.js 16 (recomendado: LTS actual)
- Red para la primera carga de ephemeris (caché `revalidate` en la ruta API)

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Otros scripts: `npm run build`, `npm run start`, `npm run lint`.

## Estructura relevante

- `app/page.tsx` — entrada: `ArtemisDashboard`
- `app/api/horizons/route.ts` — agrega Orion + Luna por JD y expone JSON tipado
- `components/ArtemisDashboard.tsx` — panel, MET, slider de tiempo
- `components/OrbitScene3D.tsx` — visor 3D (texturas Tierra/Luna, trayectoria, OrbitControls)
- `components/OrbitSvg.tsx` — vista 2D tipo diagrama de misión
- `lib/` — parsing Horizons, interpolación por JD, MET, utilidades

## Nota sobre los datos

Las posiciones son **geométricas** (sin aberración estelar) y el intervalo **START / STOP / STEP** lo eliges en el panel; Horizons puede devolver **cero puntos** si el rango cae antes de que el objeto tenga ephemeris disponible (el código documenta el caso típico post‑ICPS para Orion).

## Licencia y créditos

Ephemeris y servicio: **NASA/JPL Horizons**. Este repositorio es un proyecto de práctica; no está afiliado a la NASA.
