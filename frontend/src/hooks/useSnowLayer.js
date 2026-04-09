export function buildTrueColorUrl(dateStr) {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` +
    `MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
  )
}

// Layer: MODIS Terra NDSI Snow Cover (daily, max zoom 8)
// TileMatrixSet must be GoogleMapsCompatible_Level8 — plain "GoogleMapsCompatible" → 400
const GIBS_BASE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDSI_Snow_Cover/default'
const TILE_MATRIX_SET = 'GoogleMapsCompatible_Level8'

export function buildSnowTileUrl(dateStr) {
  return `${GIBS_BASE}/${dateStr}/${TILE_MATRIX_SET}/{z}/{y}/{x}.png`
}

// Probe a fixed tile in the Italian Alps (z=5, y=11, x=17 ≈ 49°N 11°E)
export async function findLatestGibsDate() {
  for (let i = 0; i <= 6; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    try {
      const res = await fetch(`${GIBS_BASE}/${dateStr}/${TILE_MATRIX_SET}/5/11/17.png`, {
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return dateStr
    } catch { /* timeout or network error */ }
  }
  const d = new Date()
  d.setDate(d.getDate() - 2)
  return d.toISOString().split('T')[0]
}
