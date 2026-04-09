from mcp_server import mcp

def test_mcp_has_seven_tools():
    tool_names = [t.name for t in mcp._tool_manager.list_tools()]
    assert "get_avalanche_bulletin" in tool_names
    assert "get_snow_coverage" in tool_names
    assert "get_slope_data" in tool_names
    assert "get_nearby_peaks" in tool_names
    assert "analyze_route_risk" in tool_names
    assert "get_peaks_with_data" in tool_names
    assert "get_snow_stats" in tool_names
    assert len(tool_names) == 7
