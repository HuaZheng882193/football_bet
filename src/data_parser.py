from datetime import datetime


def _parse_iso_datetime(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def parse_odds_data(raw_data):
    matches = []
    for event in raw_data:
        match = {
            "id": event["id"],
            "sport_key": event.get("sport_key"),
            "sport_title": event.get("sport_title"),
            "home_team": event["home_team"],
            "away_team": event["away_team"],
            "commence_time": _parse_iso_datetime(event["commence_time"]),
            "bookmakers": []
        }

        for bookmaker in event.get("bookmakers", []):
            bm_entry = {"bookmaker": bookmaker.get("title", "Unknown"), "home": None, "draw": None, "away": None, "spreads": [], "totals": []}
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


def parse_scores_data(raw_data):
    matches = []
    for event in raw_data:
        scores = event.get("scores") or []
        home_score = next(
            (item.get("score") for item in scores if item.get("name") == event.get("home_team")),
            None,
        )
        away_score = next(
            (item.get("score") for item in scores if item.get("name") == event.get("away_team")),
            None,
        )

        matches.append(
            {
                "id": event["id"],
                "sport_key": event.get("sport_key"),
                "sport_title": event.get("sport_title"),
                "home_team": event["home_team"],
                "away_team": event["away_team"],
                "commence_time": _parse_iso_datetime(event["commence_time"]),
                "completed": bool(event.get("completed")),
                "scores": scores,
                "home_score": home_score,
                "away_score": away_score,
                "last_update": event.get("last_update"),
            }
        )

    return matches
