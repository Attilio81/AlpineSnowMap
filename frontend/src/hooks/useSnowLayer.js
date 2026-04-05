export function buildSnowTileUrl(dateStr) {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` +
    `MODIS_Terra_Snow_Cover/default/${dateStr}/GoogleMapsCompatible/{z}/{y}/{x}.png`
  )
}
