"""AlpineSnowMap MCP Server — SSE transport.
Mount in FastAPI: app.mount("/mcp", mcp.sse_app())
"""
from datetime import date as date_type

from mcp.server.fastmcp import FastMCP

from config import (
    RISK_COLORS, RISK_LABELS,
    SLOPE_RISK_LOW, SLOPE_RISK_MOD, SLOPE_RISK_HIGH, SLOPE_RISK_VERY_HIGH,
    SLOPE_SKI_MIN, SLOPE_SKI_MAX,
    ALPS_LAT_MIN, ALPS_LAT_MAX, ALPS_LON_MIN, ALPS_LON_MAX,
    VALID_PROVINCES,
)
from services.aineva_client import fetch_bulletin
from services.peaks_service import get_nearby_peaks as _get_nearby_peaks, _haversine_km
from services.slope_service import get_slope_stats

mcp = FastMCP("AlpineSnowMap")


def _check_coords(lat: float, lon: float) -> dict | None:
    """Ritorna un dict di errore se le coordinate sono fuori dai limiti alpini, altrimenti None."""
    if not (ALPS_LAT_MIN <= lat <= ALPS_LAT_MAX) or not (ALPS_LON_MIN <= lon <= ALPS_LON_MAX):
        return {
            "error_code": "COORDS_OUT_OF_BOUNDS",
            "message": (
                f"Coordinate ({lat}, {lon}) fuori dalle Alpi italiane. "
                f"Area supportata: lat {ALPS_LAT_MIN}–{ALPS_LAT_MAX}, "
                f"lon {ALPS_LON_MIN}–{ALPS_LON_MAX}"
            ),
        }
    return None


def _slope_to_risk(avg_slope: float, max_slope: float) -> int:
    if max_slope >= SLOPE_RISK_VERY_HIGH:
        return 4
    if max_slope >= SLOPE_RISK_HIGH:
        return 3
    if avg_slope >= SLOPE_RISK_MOD:
        return 2
    if avg_slope >= SLOPE_RISK_LOW:
        return 1
    return 1


@mcp.tool()
async def get_avalanche_bulletin(province: str) -> dict:
    """Bollettino valanghe AINEVA per provincia alpina italiana (es. 'IT-23' Valle d'Aosta)."""
    if province not in VALID_PROVINCES:
        valid = ", ".join(sorted(VALID_PROVINCES.keys()))
        return {
            "error_code": "INVALID_PROVINCE",
            "message": f"Provincia '{province}' non supportata. Valori ammessi: {valid}",
        }
    try:
        data = await fetch_bulletin(province)
        if not isinstance(data, dict):
            return {"available": False, "message": "Risposta AINEVA non valida"}
        return {"available": True, **data}
    except Exception:
        return {"available": False, "message": "Bollettino temporaneamente non disponibile"}


@mcp.tool()
async def get_snow_coverage(lat: float, lon: float, date: str = "") -> dict:
    """Stima copertura neve Sentinel-2/MODIS per una coordinata. date opzionale (YYYY-MM-DD).
    Sentinel-2 ha revisita di ~5 giorni, quindi dati di oggi potrebbero non essere disponibili.
    Usa la mappa AlpineSnowMap per visualizzare NDSI in tempo reale."""
    if err := _check_coords(lat, lon):
        return err
    today = date_type.today().isoformat()
    ref_date = date or today
    return {
        "lat": lat,
        "lon": lon,
        "reference_date": ref_date,
        "today": today,
        "sentinel2_revisit_days": 5,
        "note": (
            f"Sentinel-2 non ha immagini giornaliere: revisita ~5 giorni. "
            f"Data odierna: {today}. "
            f"I dati più recenti disponibili sulla mappa potrebbero essere di alcuni giorni fa. "
            f"In condizioni di neve fresca recente, la copertura potrebbe essere sottostimata."
        ),
        "modis_daily": "MODIS (NASA GIBS) ha dati giornalieri a 500m — meno preciso ma più aggiornato.",
        "source": "Sentinel-2 L2A 10m / MODIS Terra 500m via NASA GIBS",
    }


@mcp.tool()
async def get_slope_data(lat: float, lon: float, radius_km: float = 2.0) -> dict:
    """Pendenza media e massima del terreno nell'area specificata."""
    if err := _check_coords(lat, lon):
        return err
    try:
        stats = await get_slope_stats(lat, lon)
        stats["radius_km"] = radius_km
        return stats
    except Exception:
        return {"error_code": "SLOPE_UNAVAILABLE", "message": "Dati pendenza temporaneamente non disponibili", "lat": lat, "lon": lon}


@mcp.tool()
async def get_nearby_peaks(lat: float, lon: float, radius_km: float = 10.0) -> list:
    """Cime alpine vicine a una coordinata. Ritorna lista {name, ele, distance_km}."""
    if err := _check_coords(lat, lon):
        return [err]
    try:
        return await _get_nearby_peaks(lat, lon, radius_km)
    except Exception:
        return [{"error_code": "PEAKS_UNAVAILABLE", "message": "Dati cime temporaneamente non disponibili"}]


@mcp.tool()
async def get_peaks_with_data(lat: float, lon: float, radius_km: float = 10.0) -> list:
    """Cime alpine vicine con pendenza DEM per ognuna. radius_km configurabile (default 10).
    Ritorna lista di {name, ele, distance_km, avg_slope_deg, max_slope_deg, ski_suitable}.
    ski_suitable = True se avg_slope_deg è tra 25 e 35° (ottimale per scialpinismo).
    Deduplicazione tile: più cime nello stesso tile Terrarium condividono la stessa chiamata DEM.
    """
    if err := _check_coords(lat, lon):
        return [err]
    from services.peaks_service import get_nearby_peaks as _get_peaks
    try:
        peaks = await _get_peaks(lat, lon, radius_km)
    except Exception:
        return [{"error_code": "PEAKS_UNAVAILABLE", "message": "Dati cime temporaneamente non disponibili"}]

    from services.slope_service import lat_lon_to_tile, get_slope_stats
    tile_cache: dict[tuple, dict] = {}
    result = []
    for peak in peaks:
        tx, ty = lat_lon_to_tile(peak["lat"], peak["lon"], 12)
        if (tx, ty) not in tile_cache:
            try:
                tile_cache[(tx, ty)] = await get_slope_stats(peak["lat"], peak["lon"])
            except Exception:
                tile_cache[(tx, ty)] = {"avg_slope_deg": None, "max_slope_deg": None}
        slope = tile_cache[(tx, ty)]
        avg = slope.get("avg_slope_deg")
        result.append({
            **peak,
            "avg_slope_deg": avg,
            "max_slope_deg": slope.get("max_slope_deg"),
            "ski_suitable": (SLOPE_SKI_MIN <= avg <= SLOPE_SKI_MAX) if avg is not None else None,
        })
    return result


@mcp.tool()
async def get_snow_stats(lat: float, lon: float) -> dict:
    """Copertura neve da MODIS (giornaliero 500m) e Sentinel-2 (10m, revisita ~5 giorni).
    MODIS: classificazione snow/cloud/no_snow per oggi.
    Sentinel-2: percentuale area coperta da neve (densa + leggera) con data acquisizione.
    """
    if err := _check_coords(lat, lon):
        return err
    from services.snow_service import get_snow_stats as _get_snow
    try:
        return await _get_snow(lat, lon)
    except Exception:
        return {"error_code": "SNOW_STATS_UNAVAILABLE", "message": "Statistiche neve temporaneamente non disponibili"}


@mcp.tool()
async def analyze_route_risk(geojson: dict, province: str = "IT-23") -> dict:
    """Risk score valanghe per segmento su traccia GPX/GeoJSON LineString.
    Ritorna: {segments: [{risk: 1-5, color: str, label: str, reason: str, midpoint: [lon,lat]}],
              overall_risk: int, overall_color: str, bulletin_danger: int|null}
    """
    if province not in VALID_PROVINCES:
        valid = ", ".join(sorted(VALID_PROVINCES.keys()))
        return {
            "error_code": "INVALID_PROVINCE",
            "message": f"Provincia '{province}' non supportata. Valori ammessi: {valid}",
        }

    coords = []
    if geojson.get("type") == "FeatureCollection":
        for feat in geojson.get("features", []):
            geom = feat.get("geometry", {})
            if geom.get("type") == "LineString":
                coords = geom["coordinates"]
                break
    elif geojson.get("type") == "Feature":
        coords = geojson.get("geometry", {}).get("coordinates", [])
    elif geojson.get("type") == "LineString":
        coords = geojson.get("coordinates", [])

    if len(coords) < 2:
        return {"error_code": "INVALID_GEOJSON", "message": "GeoJSON deve contenere una LineString con almeno 2 coordinate"}

    bulletin = await get_avalanche_bulletin(province)
    bulletin_danger = bulletin.get("maxDanger") if bulletin.get("available") else None

    step = max(1, len(coords) // 10)
    segments = []

    for i in range(0, len(coords) - 1, step):
        c0 = coords[i]
        c1 = coords[min(i + step, len(coords) - 1)]
        mid_lon = (c0[0] + c1[0]) / 2
        mid_lat = (c0[1] + c1[1]) / 2

        try:
            slope_data = await get_slope_stats(mid_lat, mid_lon)
            terrain_risk = _slope_to_risk(slope_data["avg_slope_deg"], slope_data["max_slope_deg"])
        except Exception:
            slope_data = {"avg_slope_deg": 0, "max_slope_deg": 0}
            terrain_risk = 1

        combined_risk = min(5, max(terrain_risk, bulletin_danger - 1)) if bulletin_danger else terrain_risk
        reason_parts = [f"Pendenza media {slope_data['avg_slope_deg']}°, max {slope_data['max_slope_deg']}°"]
        if bulletin_danger:
            reason_parts.append(f"Pericolo AINEVA: {bulletin_danger}/5")

        segments.append({
            "risk": combined_risk,
            "color": RISK_COLORS[combined_risk],
            "label": RISK_LABELS[combined_risk],
            "reason": " · ".join(reason_parts),
            "avg_slope_deg": slope_data["avg_slope_deg"],
            "max_slope_deg": slope_data["max_slope_deg"],
            "midpoint": [mid_lon, mid_lat],
        })

    overall_risk = max(s["risk"] for s in segments) if segments else 1
    return {
        "segments": segments,
        "overall_risk": overall_risk,
        "overall_color": RISK_COLORS[overall_risk],
        "overall_label": RISK_LABELS[overall_risk],
        "bulletin_danger": bulletin_danger,
    }
