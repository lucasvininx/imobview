import { z } from "zod";

export const facades = ["N", "E", "S", "W"] as const;
export type Facade = (typeof facades)[number];
export const facadeLabels = {
  N: "Norte",
  E: "Leste",
  S: "Sul",
  W: "Oeste",
} as const satisfies Record<Facade, string>;
export const amenities = ["pool", "court", "playground", "garden"] as const;
export type Amenity = (typeof amenities)[number];
export const amenityLabels = {
  pool: "Piscina",
  court: "Quadra",
  playground: "Playground",
  garden: "Jardim",
} as const satisfies Record<Amenity, string>;
// Brazilian time zones (offset from UTC, no daylight saving since 2019).
export const utcOffsets = [-2, -3, -4, -5] as const;

export const exteriorSchema = z
  .object({
    enabled: z.boolean(),
    buildingName: z.string().trim().max(80).default(""),
    latitude: z.number().finite().min(-60).max(60),
    longitude: z.number().finite().min(-180).max(180),
    utcOffset: z
      .number()
      .int()
      .refine((value) => (utcOffsets as readonly number[]).includes(value))
      .default(-3),
    towers: z.number().int().min(1).max(4),
    floors: z.number().int().min(2).max(60),
    unitTower: z.number().int().min(1).max(4),
    unitFloor: z.number().int().min(1).max(60),
    unitFacade: z.enum(facades),
    amenities: z.array(z.enum(amenities)).max(amenities.length).default([]),
  })
  .refine((v) => v.unitTower <= v.towers, {
    message: "A torre do apartamento não existe nesse condomínio.",
    path: ["unitTower"],
  })
  .refine((v) => v.unitFloor <= v.floors, {
    message:
      "O andar do apartamento deve ser menor ou igual ao número de andares.",
    path: ["unitFloor"],
  })
  .refine((v) => new Set(v.amenities).size === v.amenities.length, {
    message: "Itens de lazer repetidos.",
    path: ["amenities"],
  });
export type ExteriorConfig = z.infer<typeof exteriorSchema>;

// "-23.5613, -46.6565" as copied from a map app.
export function parseCoordinates(text: string) {
  const match = text
    .trim()
    .match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!match) return null;
  const [latitude, longitude] = [match[1], match[2]].map((part) =>
    Number(part.replace(",", ".")),
  );
  return Math.abs(latitude) <= 60 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}
