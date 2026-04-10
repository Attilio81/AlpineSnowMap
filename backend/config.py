"""Costanti e configurazione centralizzata per AlpineSnowMap."""

# === Bounding box Alpi italiane ===
ALPS_LAT_MIN = 44.0
ALPS_LAT_MAX = 47.2
ALPS_LON_MIN = 6.5
ALPS_LON_MAX = 14.0

# === Province alpine italiane supportate ===
VALID_PROVINCES: dict[str, str] = {
    "IT-21":    "Piemonte",
    "IT-23":    "Valle d'Aosta",
    "IT-25":    "Lombardia",
    "IT-32-BZ": "Alto Adige / Südtirol",
    "IT-32-TN": "Trentino",
    "IT-34":    "Veneto",
    "IT-36":    "Friuli Venezia Giulia",
    "IT-57":    "Toscana (Appennino)",
}

# === Soglie pendenza (gradi) per rischio valanghe ===
SLOPE_RISK_LOW       = 25    # pendenza minima da segnalare (rischio 1)
SLOPE_RISK_MOD       = 30    # pendenza moderata (rischio 2)
SLOPE_RISK_HIGH      = 35    # pendenza alta (rischio 3)
SLOPE_RISK_VERY_HIGH = 40    # pendenza molto alta (rischio 4+)
SLOPE_MAX_DEG        = 90    # limite superiore per la classificazione

# Intervallo ottimale per scialpinismo
SLOPE_SKI_MIN = 25.0
SLOPE_SKI_MAX = 35.0

# === Layer slope — colori RGBA per intervallo (min_deg, max_deg, R, G, B, A) ===
SLOPE_COLORS: list[tuple[int, int, int, int, int, int]] = [
    (SLOPE_RISK_LOW,       SLOPE_RISK_MOD,        51, 204,  51, 130),  # verde
    (SLOPE_RISK_MOD,       SLOPE_RISK_HIGH,       255, 204,   0, 165),  # giallo
    (SLOPE_RISK_HIGH,      SLOPE_RISK_VERY_HIGH,  255, 102,   0, 191),  # arancio
    (SLOPE_RISK_VERY_HIGH, SLOPE_MAX_DEG,         204,   0,   0, 210),  # rosso
]

# === Limiti zoom tile slope ===
SLOPE_TILE_Z_MIN = 7
SLOPE_TILE_Z_MAX = 14

# === Soglie NDSI (Normalized Difference Snow Index) ===
NDSI_LIGHT_SNOW = 0.2   # neve leggera / possibile copertura nevosa
NDSI_DENSE_SNOW = 0.4   # neve densa / copertura certa

# Colori RGBA per le soglie NDSI nel rendering Sentinel-2
NDSI_COLOR_LIGHT = (153, 217, 255, 153)   # azzurro 60% — neve leggera
NDSI_COLOR_DENSE = (38,  140, 255, 217)   # blu 85%    — neve densa

# === Etichette e colori rischio valanghe (scala EAWS 1-5) ===
RISK_COLORS: dict[int, str] = {
    1: "#CCFF66",
    2: "#FFFF00",
    3: "#FF9900",
    4: "#FF0000",
    5: "#8B0000",
}
RISK_LABELS: dict[int, str] = {
    1: "Debole",
    2: "Limitato",
    3: "Marcato",
    4: "Forte",
    5: "Molto forte",
}

# === Cache ===
COPERNICUS_MAX_CACHE_TILES = 500
EAWS_CACHE_TTL_SECONDS     = 6 * 3600   # 6 ore
