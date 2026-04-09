import io
from unittest.mock import patch, AsyncMock
import asyncio
from PIL import Image
import numpy as np


def _make_png(r, g, b, a=255) -> bytes:
    """Create a 256x256 solid-color PNG."""
    arr = np.full((256, 256, 4), [r, g, b, a], dtype=np.uint8)
    img = Image.fromarray(arr, "RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_classify_modis_snow():
    from services.snow_service import _classify_modis_pixel
    assert _classify_modis_pixel(230, 240, 255, 255) == "snow"

def test_classify_modis_cloud():
    from services.snow_service import _classify_modis_pixel
    assert _classify_modis_pixel(190, 192, 188, 255) == "cloud"

def test_classify_modis_no_snow():
    from services.snow_service import _classify_modis_pixel
    assert _classify_modis_pixel(40, 50, 45, 255) == "no_snow"

def test_classify_modis_transparent():
    from services.snow_service import _classify_modis_pixel
    assert _classify_modis_pixel(0, 0, 0, 0) == "no_data"

def test_sentinel_snow_coverage_dense():
    from services.snow_service import _analyze_sentinel_png
    png = _make_png(38, 140, 255, 255)
    result = _analyze_sentinel_png(png)
    assert result["snow_coverage_pct"] == 100.0
    assert result["ndsi_class"] == "densa"

def test_sentinel_snow_coverage_none():
    from services.snow_service import _analyze_sentinel_png
    png = _make_png(0, 0, 0, 0)
    result = _analyze_sentinel_png(png)
    assert result["snow_coverage_pct"] == 0.0
    assert result["ndsi_class"] == "assente"
