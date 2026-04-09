const R = 6371000 // Earth radius in meters

/** Great-circle distance in meters between two {lng,lat} or [lng,lat] points */
export function haversine(a, b) {
  const [lng1, lat1] = Array.isArray(a) ? a : [a.lng, a.lat]
  const [lng2, lat2] = Array.isArray(b) ? b : [b.lng, b.lat]
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const sinA = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(sinA))
}

/** Linear interpolation of {lng,lat} at fraction t between p1 and p2 */
export function lerpLngLat(p1, p2, t) {
  return {
    lng: p1.lng + (p2.lng - p1.lng) * t,
    lat: p1.lat + (p2.lat - p1.lat) * t,
  }
}
