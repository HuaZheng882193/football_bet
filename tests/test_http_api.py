import os
import sys

from fastapi.testclient import TestClient

os.environ.setdefault("translators_default_region", "CN")

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


def test_get_scores_parsed(monkeypatch):
    monkeypatch.setattr(http_api.translator, "translate_matches", lambda matches: matches)

    class StubClient:
        def get_scores(self, sport, days_from):
            assert sport == "soccer_epl"
            assert days_from == 2
            return [
                {
                    "id": "match-1",
                    "sport_key": "soccer_epl",
                    "sport_title": "EPL",
                    "home_team": "Arsenal",
                    "away_team": "Chelsea",
                    "commence_time": "2026-03-20T12:00:00Z",
                    "completed": True,
                    "scores": [
                        {"name": "Arsenal", "score": "2"},
                        {"name": "Chelsea", "score": "1"},
                    ],
                    "last_update": "2026-03-20T14:00:00Z",
                }
            ]

    monkeypatch.setattr(http_api, "get_client", lambda: StubClient())

    client = TestClient(http_api.app)
    response = client.get("/scores?sport=soccer_epl&daysFrom=2")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["home_score"] == "2"
    assert body[0]["away_score"] == "1"
    assert body[0]["completed"] is True


def test_get_score_bets(monkeypatch):
    monkeypatch.setattr(http_api.translator, "translate_matches", lambda matches: matches)

    class StubClient:
        def get_odds(self, sport, regions, markets):
            assert sport == "soccer_epl"
            assert regions == "us,uk,au"
            assert markets == "h2h,totals"
            return [
                {
                    "id": "match-1",
                    "sport_key": "soccer_epl",
                    "sport_title": "EPL",
                    "home_team": "Arsenal",
                    "away_team": "Chelsea",
                    "commence_time": "2026-03-20T12:00:00Z",
                    "bookmakers": [
                        {
                            "markets": [
                                {
                                    "key": "h2h",
                                    "outcomes": [
                                        {"name": "Arsenal", "price": 1.9},
                                        {"name": "Draw", "price": 3.4},
                                        {"name": "Chelsea", "price": 4.1},
                                    ],
                                },
                                {
                                    "key": "totals",
                                    "outcomes": [
                                        {"name": "Over", "point": 2.5, "price": 1.95},
                                        {"name": "Under", "point": 2.5, "price": 1.85},
                                    ],
                                },
                            ]
                        }
                    ],
                }
            ]

    monkeypatch.setattr(http_api, "get_client", lambda: StubClient())

    client = TestClient(http_api.app)
    response = client.get("/score-bets?sport=soccer_epl")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["market_key"] == "correct_score"
    assert body[0]["bookmaker"] == "Score Engine"
    assert len(body[0]["options"]) == 25
    assert body[0]["options"][0]["score"] == "0:0"


def test_get_score_bets_summary_and_single_event(monkeypatch):
    monkeypatch.setattr(http_api.translator, "translate_matches", lambda matches: matches)

    class StubClient:
        def get_odds(self, sport, regions, markets):
            return [
                {
                    "id": "match-1",
                    "sport_key": "soccer_epl",
                    "sport_title": "EPL",
                    "home_team": "Arsenal",
                    "away_team": "Chelsea",
                    "commence_time": "2026-03-20T12:00:00Z",
                    "bookmakers": [
                        {
                            "title": "BetMGM",
                            "markets": [
                                {
                                    "key": "h2h",
                                    "outcomes": [
                                        {"name": "Arsenal", "price": 1.9},
                                        {"name": "Draw", "price": 3.4},
                                        {"name": "Chelsea", "price": 4.1},
                                    ],
                                },
                                {
                                    "key": "totals",
                                    "outcomes": [
                                        {"name": "Over", "point": 2.5, "price": 1.95},
                                        {"name": "Under", "point": 2.5, "price": 1.85},
                                    ],
                                },
                            ],
                        }
                    ],
                }
            ]

    monkeypatch.setattr(http_api, "get_client", lambda: StubClient())

    client = TestClient(http_api.app)

    summary = client.get("/score-bets?sport=soccer_epl&includeOptions=false")
    assert summary.status_code == 200
    summary_body = summary.json()
    assert summary_body[0]["options"] == []
    assert summary_body[0]["option_count"] == 25

    detail = client.get("/score-bets?sport=soccer_epl&eventId=match-1&includeOptions=true")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert len(detail_body) == 1
    assert detail_body[0]["id"] == "match-1"
    assert len(detail_body[0]["options"]) == 25


def test_settle_exact_score_bets(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    bets_path = tmp_path / "bets.json"
    bets_path.write_text(
        (
            '[{"id":"bet-1","bet_type":"correct_score","sport_key":"soccer_epl",'
            '"matchId":"match-1","selection":"2:1","stake":100,"price":9.5,"status":null}]'
        ),
        encoding="utf-8",
    )

    class StubClient:
        def get_scores(self, sport, days_from):
            assert sport == "soccer_epl"
            assert days_from == 3
            return [
                {
                    "id": "match-1",
                    "sport_key": "soccer_epl",
                    "sport_title": "EPL",
                    "home_team": "Arsenal",
                    "away_team": "Chelsea",
                    "commence_time": "2026-03-20T12:00:00Z",
                    "completed": True,
                    "scores": [
                        {"name": "Arsenal", "score": "2"},
                        {"name": "Chelsea", "score": "1"},
                    ],
                    "last_update": "2026-03-20T14:00:00Z",
                }
            ]

    monkeypatch.setattr(http_api, "get_client", lambda: StubClient())

    client = TestClient(http_api.app)
    response = client.post("/score-bets/settle")

    assert response.status_code == 200
    body = response.json()
    assert body["settled_count"] == 1

    saved_bets = bets_path.read_text(encoding="utf-8")
    assert '"status": "win"' in saved_bets
    assert '"result_score": "2:1"' in saved_bets


def test_clear_all_bets(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    bets_path = tmp_path / "bets.json"
    bets_path.write_text(
        '[{"id":"bet-1","stake":10},{"id":"bet-2","stake":20}]',
        encoding="utf-8",
    )

    client = TestClient(http_api.app)
    response = client.post("/bets/clear")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["cleared_count"] == 2
    assert bets_path.read_text(encoding="utf-8").strip() == "[]"


def test_cancel_bet_removes_record(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    bets_path = tmp_path / "bets.json"
    bets_path.write_text(
        '[{"id":"bet-1","stake":10},{"id":"bet-2","stake":20}]',
        encoding="utf-8",
    )

    client = TestClient(http_api.app)
    response = client.post("/bets/cancel", json={"id": "bet-1"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["canceled_bet"]["id"] == "bet-1"
    assert bets_path.read_text(encoding="utf-8").strip() == '[\n  {\n    "id": "bet-2",\n    "stake": 20\n  }\n]'


def test_cancel_bet_rejects_settled_record(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    bets_path = tmp_path / "bets.json"
    bets_path.write_text(
        '[{"id":"bet-1","stake":10,"status":"win"}]',
        encoding="utf-8",
    )

    client = TestClient(http_api.app)
    response = client.post("/bets/cancel", json={"id": "bet-1"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Settled bets cannot be canceled"
    assert '"id":"bet-1"' in bets_path.read_text(encoding="utf-8")


def test_settle_bet_calculates_payout_and_house_profit(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    bets_path = tmp_path / "bets.json"
    bets_path.write_text(
        '[{"id":"bet-1","stake":100,"price":2.5,"status":null}]',
        encoding="utf-8",
    )

    client = TestClient(http_api.app)
    response = client.post("/bets/settle", json={"id": "bet-1", "status": "win"})

    assert response.status_code == 200
    updated_bet = response.json()["updated_bet"]
    assert updated_bet["status"] == "win"
    assert updated_bet["payout"] == 250.0
    assert updated_bet["house_profit"] == -150.0
    assert "settled_at" in updated_bet

    saved_bets = bets_path.read_text(encoding="utf-8")
    assert '"payout": 250.0' in saved_bets
    assert '"house_profit": -150.0' in saved_bets


def test_settle_bet_to_unsettled_clears_settlement_fields(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    bets_path = tmp_path / "bets.json"
    bets_path.write_text(
        '[{"id":"bet-2","stake":100,"price":2.0,"status":"win","payout":200.0,"house_profit":-100.0,"settled_at":"2026-03-24T00:00:00+00:00"}]',
        encoding="utf-8",
    )

    client = TestClient(http_api.app)
    response = client.post("/bets/settle", json={"id": "bet-2", "status": None})

    assert response.status_code == 200
    updated_bet = response.json()["updated_bet"]
    assert updated_bet["status"] is None
    assert "payout" not in updated_bet
    assert "house_profit" not in updated_bet
    assert "settled_at" not in updated_bet
