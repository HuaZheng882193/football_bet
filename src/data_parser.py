from datetime import datetime

def parse_odds_data(raw_data):
    matches = []
    for event in raw_data:
        match = {
            "id": event["id"],
            "sport_key": event.get("sport_key"),
            "sport_title": event.get("sport_title"),
            "home_team": event["home_team"],
            "away_team": event["away_team"],
            "commence_time": datetime.fromisoformat(event["commence_time"].replace("Z", "+00:00")),
            "bookmakers": []
        }

        for bookmaker in event.get("bookmakers", []):
            bm_entry = {"bookmaker": bookmaker["title"], "home": None, "draw": None, "away": None, "spreads": [], "totals": []}
            for market in bookmaker.get("markets", []):
                if market["key"] == "h2h":
                    bm_entry["home"] = next((o["price"] for o in market["outcomes"] if o["name"] == event["home_team"]), None)
                    bm_entry["draw"] = next((o["price"] for o in market["outcomes"] if o["name"] == "Draw"), None)
                    bm_entry["away"] = next((o["price"] for o in market["outcomes"] if o["name"] == event["away_team"]), None)
                elif market["key"] == "spreads":
                    for o in market["outcomes"]:
                        bm_entry["spreads"].append({
                            "name": o["name"],
                            "point": o.get("point"),
                            "price": o["price"]
                        })
                elif market["key"] == "totals":
                    for o in market["outcomes"]:
                        bm_entry["totals"].append({
                            "name": o["name"],
                            "point": o.get("point"),
                            "price": o["price"]
                        })
            match["bookmakers"].append(bm_entry)

        matches.append(match)
    return matches
