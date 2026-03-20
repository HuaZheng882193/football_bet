import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import http_api


def test_health_check():
    client = TestClient(http_api.app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_odds_parsed(monkeypatch):
    monkeypatch.setattr(http_api.translator, "translate_matches", lambda matches: matches)

    class StubClient:
        def get_odds(self, sport, regions, markets):
            assert sport == "soccer_epl"
            assert regions == "us"
            assert markets == "h2h"
            return [
                {
                    "id": "match-1",
                    "sport_key": "soccer_epl",
                    "sport_title": "EPL",
                    "home_team": "Arsenal",
                    "away_team": "Chelsea",
                    "commence_time": "2026-03-20T12:00:00Z",
                    "bookmakers": [],
                }
            ]

    monkeypatch.setattr(http_api, "get_client", lambda: StubClient())

    client = TestClient(http_api.app)
    response = client.get("/odds?sport=soccer_epl&regions=us&markets=h2h")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["sport_title"] == "EPL"
    assert body[0]["home_team"] == "Arsenal"
    assert body[0]["away_team"] == "Chelsea"
    assert body[0]["bookmakers"] == []


def test_get_sports(monkeypatch):
    monkeypatch.setattr(http_api.translator, "translate_sports", lambda sports: sports)

    class StubClient:
        def get_sports(self):
            return [{"key": "soccer_epl", "title": "EPL"}]

    monkeypatch.setattr(http_api, "get_client", lambda: StubClient())

    client = TestClient(http_api.app)
    response = client.get("/sports")

    assert response.status_code == 200
    assert response.json() == [{"key": "soccer_epl", "title": "EPL"}]
