teams = [
    "Manchester United", "Manchester City", "Spurs", "Arsenal",
    "Chelsea", "Liverpool", "Barcelona", "Real Madrid",
    "Atletico Madrid", "Juventus", "Napoli", "Inter Milan",
    "AC Milan", "PSG", "BVB", "Bayern Munich"
]

# Empty table (no fake performance data)
table = [
    {"pos": i+1, "team": team, "played": 0, "won": 0, "drawn": 0, "lost": 0, "gd": 0, "pts": 0}
    for i, team in enumerate(teams)
]

# Fixtures ONLY (no results, no assumptions)
fixtures = [
    {"home": "Manchester United", "away": "Real Madrid"},
    {"home": "Barcelona", "away": "Liverpool"},
    {"home": "Arsenal", "away": "Bayern Munich"},
    {"home": "PSG", "away": "Chelsea"},
]

# Empty scorers (user-controlled later)
scorers = []