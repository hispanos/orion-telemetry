export type EphemerisApiSample = {
  jd: number;
  calendar: string;
  orionKm: { x: number; y: number; z: number };
  moonKm: { x: number; y: number; z: number };
  distEarthCenterKm: number;
  altitudeKm: number;
  distMoonCenterKm: number;
  distMoonSurfaceKm: number;
  speedKmS: number;
};

export type EphemerisApiResponse = {
  meta: {
    frame: string;
    earthEquatorRadiusKm: number;
    moonMeanRadiusKm: number;
    start: string;
    stop: string;
    step: string;
  };
  samples: EphemerisApiSample[];
};
