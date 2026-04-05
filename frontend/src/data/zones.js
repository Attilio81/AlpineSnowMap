export const ZONES = [
  {
    id: 'IT-23',
    name: "Valle d'Aosta",
    centroid: [7.32, 45.74],
    bbox: [6.80, 45.40, 7.95, 45.95],
  },
  {
    id: 'IT-21',
    name: 'Piemonte',
    centroid: [7.70, 44.50],
    bbox: [6.60, 44.00, 8.90, 46.50],
  },
  {
    id: 'IT-25',
    name: 'Lombardia',
    centroid: [9.90, 46.10],
    bbox: [8.50, 45.40, 10.50, 46.60],
  },
  {
    id: 'IT-32-TN',
    name: 'Trentino',
    centroid: [11.12, 46.07],
    bbox: [10.45, 45.65, 11.95, 46.55],
  },
  {
    id: 'IT-32-BZ',
    name: 'Alto Adige',
    centroid: [11.40, 46.70],
    bbox: [10.45, 46.30, 12.45, 47.10],
  },
  {
    id: 'IT-34',
    name: 'Veneto',
    centroid: [11.95, 46.40],
    bbox: [11.55, 45.70, 12.75, 46.65],
  },
  {
    id: 'IT-36',
    name: 'Friuli-Venezia Giulia',
    centroid: [13.20, 46.35],
    bbox: [12.30, 45.90, 13.85, 46.65],
  },
]

export const DEFAULT_ZONE = ZONES[0] // Valle d'Aosta

/** Returns the zone whose bbox contains [lng, lat], or DEFAULT_ZONE */
export function findZoneByCoords(lng, lat) {
  const match = ZONES.find(
    z => lng >= z.bbox[0] && lat >= z.bbox[1] && lng <= z.bbox[2] && lat <= z.bbox[3]
  )
  return match ?? DEFAULT_ZONE
}
