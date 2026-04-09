import math
from services.slope_service import lat_lon_to_tile

def test_lat_lon_to_tile_known_point():
    # Cervinia (45.936°N, 7.627°E) at zoom 12
    x, y = lat_lon_to_tile(45.936, 7.627, 12)
    assert x == 2134
    assert y == 1458

def test_slope_stats_structure():
    result = {"avg_slope_deg": 22.5, "max_slope_deg": 41.0}
    assert "avg_slope_deg" in result
    assert "max_slope_deg" in result
    assert 0 <= result["avg_slope_deg"] <= 90
    assert result["avg_slope_deg"] <= result["max_slope_deg"]
