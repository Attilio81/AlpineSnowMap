def test_build_team_returns_team_with_four_members():
    from agno.team.team import Team
    from services.agno_team import build_team
    team = build_team()
    assert isinstance(team, Team)
    assert len(team.members) == 4


def test_team_member_names():
    from services.agno_team import build_team
    team = build_team()
    names = [m.name for m in team.members]
    assert "Agente Terreno" in names
    assert "Agente Neve/Meteo" in names
    assert "Agente Valanghe" in names
    assert "Agente Web" in names
