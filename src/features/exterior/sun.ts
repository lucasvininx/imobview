// Solar position (NOAA / Astronomical Almanac low-precision formulas, ~0.01° until 2050).
const RAD = Math.PI / 180;

export type SunPosition = {
  // Radians above the horizon; negative means night.
  altitude: number;
  // Radians clockwise from true north (0 = N, PI/2 = E).
  azimuth: number;
};

export function sunPosition(
  instant: Date,
  latitude: number,
  longitude: number,
): SunPosition {
  const n = instant.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const meanLongitude = (280.46 + 0.9856474 * n) % 360;
  const anomaly = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) *
    RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(eclipticLongitude),
  );
  const siderealHours = (18.697374558 + 24.06570982441908 * n) % 24;
  const hourAngle = (siderealHours * 15 + longitude) * RAD - rightAscension;
  const phi = latitude * RAD;
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(declination) +
      Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle),
  );
  const azimuth = Math.atan2(
    -Math.sin(hourAngle),
    Math.tan(declination) * Math.cos(phi) - Math.sin(phi) * Math.cos(hourAngle),
  );
  return { altitude, azimuth: (azimuth + 2 * Math.PI) % (2 * Math.PI) };
}

// Local wall-clock time at the property (fixed offset, as Brazil has no DST).
export function localInstant(date: string, minutes: number, utcOffset: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day) + (minutes - utcOffset * 60) * 60000,
  );
}

// Unit vector towards the sun in scene axes: x east, y up, z south.
export function sunDirection({ altitude, azimuth }: SunPosition) {
  return {
    x: Math.sin(azimuth) * Math.cos(altitude),
    y: Math.sin(altitude),
    z: -Math.cos(azimuth) * Math.cos(altitude),
  };
}
