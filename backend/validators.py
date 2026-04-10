"""Validatori riusabili per input API di AlpineSnowMap."""
import re
from datetime import date as date_type

from fastapi import HTTPException

from config import ALPS_LAT_MIN, ALPS_LAT_MAX, ALPS_LON_MIN, ALPS_LON_MAX, VALID_PROVINCES

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_alpine_coords(lat: float, lon: float) -> None:
    """Verifica che le coordinate siano all'interno del bounding box delle Alpi italiane.

    Raises:
        HTTPException 400 se fuori dai limiti.
    """
    if not (ALPS_LAT_MIN <= lat <= ALPS_LAT_MAX):
        raise HTTPException(
            status_code=400,
            detail=f"Latitudine {lat} fuori dai limiti delle Alpi italiane ({ALPS_LAT_MIN}–{ALPS_LAT_MAX})",
        )
    if not (ALPS_LON_MIN <= lon <= ALPS_LON_MAX):
        raise HTTPException(
            status_code=400,
            detail=f"Longitudine {lon} fuori dai limiti delle Alpi italiane ({ALPS_LON_MIN}–{ALPS_LON_MAX})",
        )


def validate_province(province: str) -> None:
    """Verifica che il codice provincia sia tra quelli supportati.

    Raises:
        HTTPException 400 se non riconosciuto.
    """
    if province not in VALID_PROVINCES:
        valid = ", ".join(sorted(VALID_PROVINCES.keys()))
        raise HTTPException(
            status_code=400,
            detail=f"Provincia '{province}' non supportata. Valori ammessi: {valid}",
        )


def validate_date(date_str: str) -> None:
    """Verifica che la stringa sia una data ISO valida (YYYY-MM-DD) non futura.

    Raises:
        HTTPException 400 se non valida.
    """
    if not _DATE_RE.match(date_str):
        raise HTTPException(status_code=400, detail=f"Formato data non valido: '{date_str}'. Atteso YYYY-MM-DD")
    try:
        parsed = date_type.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Data non valida: '{date_str}'")
    if parsed > date_type.today():
        raise HTTPException(status_code=400, detail=f"La data '{date_str}' è nel futuro")
