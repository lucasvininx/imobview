// Authored against the panoramas: yaw 0 is the image centre.
// Inner rooms are reached through the hall; gourmet is reached via the balcony.
export const apartmentDoorways = [
  { from: 0, to: 1, yaw: 2.78, pitch: -0.14 },
  { from: 1, to: 0, yaw: 2.25, pitch: -0.14 },
  { from: 0, to: 3, yaw: -0.55, pitch: -0.16 },
  { from: 3, to: 0, yaw: 2.3, pitch: -0.17 },
  { from: 0, to: 4, yaw: -2.86, pitch: -0.08, via: "Pelo corredor" },
  { from: 4, to: 0, yaw: -3, pitch: -0.15, via: "Pelo corredor" },
  { from: 0, to: 5, yaw: -2.75, pitch: -0.38, via: "Pelo corredor" },
  { from: 5, to: 0, yaw: -2.45, pitch: -0.15, via: "Pelo corredor" },
  { from: 0, to: 6, yaw: -2.58, pitch: -0.68, via: "Pelo corredor" },
  { from: 6, to: 0, yaw: -2.28, pitch: -0.12, via: "Pelo corredor" },
  { from: 2, to: 3, yaw: 2.25, pitch: -0.16 },
  { from: 3, to: 2, yaw: -2.42, pitch: -0.2 },
  { from: 4, to: 7, yaw: -1.3, pitch: -0.14 },
  { from: 7, to: 4, yaw: -2.63, pitch: -0.13 },
];
