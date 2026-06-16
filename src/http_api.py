import json
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from requests import HTTPError

from api_client import OddsAPIClient
from data_parser import parse_odds_data, parse_scores_data, parse_outrights_data
from score_bet_service import build_exact_score_markets, build_exact_score_result_map
from translation_service import translator

app = FastAPI(
    title="Football Bet API",
    version="1.0.0",
    description="External HTTP API wrapper for The Odds API client.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_float(value, fallback=0.0):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed


def _round_money(value):
    return round(float(value) + 1e-9, 2)


def _apply_bet_settlement(bet: dict, status):
    if status not in {None, "win", "lose", "void"}:
        raise HTTPException(status_code=400, detail="Invalid status value")

    if status is None:
        bet["status"] = None
        bet.pop("payout", None)
        bet.pop("house_profit", None)
        bet.pop("settled_at", None)
        return

    stake = _to_float(bet.get("stake"), 0.0)
    price = _to_float(bet.get("price"), 0.0)

    if status == "win":
        payout = _round_money(stake * price / 2)
        house_profit = _round_money(stake - payout)
    elif status == "lose":
        payout = 0.0
        house_profit = _round_money(stake)
    else:  # status == "void"
        payout = _round_money(stake)
        house_profit = 0.0

    bet["status"] = status
    bet["payout"] = payout
    bet["house_profit"] = house_profit
    bet["settled_at"] = datetime.now(timezone.utc).isoformat()


def get_client():
    try:
        return OddsAPIClient()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/sports")
def get_sports():
    client = get_client()
    try:
        return translator.translate_sports(client.get_sports())
    except HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc


@app.get("/scores")
def get_scores(
    sport: str = Query(..., description="Sport key, e.g. soccer_epl"),
    daysFrom: int = Query(1, ge=1, le=7),
    parsed: bool = Query(True, description="Return parsed structure when true"),
):
    client = get_client()
    try:
        raw_data = client.get_scores(sport=sport, days_from=daysFrom)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc

    if not parsed:
        return raw_data

    return translator.translate_matches(parse_scores_data(raw_data))


@app.get("/odds")
def get_odds(
    sport: str = Query(..., description="Sport key, e.g. soccer_epl"),
    regions: str = Query("us,uk,au"),
    markets: str = Query("h2h,spreads,totals"),
    parsed: bool = Query(True, description="Return parsed structure when true"),
):
    client = get_client()
    try:
        raw_data = client.get_odds(sport=sport, regions=regions, markets=markets)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc

    if not parsed:
        return raw_data

    return translator.translate_matches(parse_odds_data(raw_data))


@app.get("/outrights")
def get_outrights(
    sport: str = Query(..., description="Sport key, e.g. soccer_fifa_world_cup_winner"),
    regions: str = Query("us,uk,au"),
    parsed: bool = Query(True, description="Return parsed structure when true"),
):
    client = get_client()
    try:
        raw_data = client.get_odds(sport=sport, regions=regions, markets="outrights")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc

    if not parsed:
        return raw_data

    return translator.translate_outrights(parse_outrights_data(raw_data))



@app.get("/score-bets")
def get_exact_score_bets(
    sport: str = Query(..., description="Sport key, e.g. soccer_epl"),
    regions: str = Query("us,uk,au"),
    eventId: str | None = Query(None),
    includeOptions: bool = Query(True),
):
    client = get_client()
    try:
        raw_data = client.get_odds(
            sport=sport,
            regions=regions,
            markets="h2h,totals",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc

    if eventId:
        raw_data = [event for event in raw_data if event.get("id") == eventId]
    translated_events = translator.translate_matches(parse_odds_data(raw_data))

    events_for_pricing = []
    translated_map = {item["id"]: item for item in translated_events}
    for event in raw_data:
        translated = translated_map.get(event["id"], {})
        merged_event = dict(event)
        merged_event["home_team"] = translated.get("home_team", event.get("home_team"))
        merged_event["away_team"] = translated.get("away_team", event.get("away_team"))
        merged_event["sport_title"] = translated.get("sport_title", event.get("sport_title"))
        events_for_pricing.append(merged_event)

    return build_exact_score_markets(events_for_pricing, include_options=includeOptions)

@app.post("/bet")
async def save_bet(request: Request):
    try:
        data = await request.json()
        filepath = "data/bets.json"
        os.makedirs("data", exist_ok=True)

        bets = []
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                try:
                    bets = json.load(f)
                except json.JSONDecodeError:
                    bets = []

        data.setdefault("status", None)
        data.setdefault("bet_type", "standard")
        data.pop("payout", None)
        data.pop("house_profit", None)
        data.pop("settled_at", None)

        bets.append(data)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(bets, f, ensure_ascii=False, indent=2)
            
        return {"status": "success", "message": "Bet saved successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.get("/bets")
def get_all_bets():
    filepath = "data/bets.json"
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.post("/bets/settle")
async def settle_bet(request: Request):
    try:
        data = await request.json()
        bet_id = data.get("id")
        status = data.get("status")

        if not bet_id or "status" not in data:
            raise HTTPException(status_code=400, detail="Missing id or status key")

        filepath = "data/bets.json"
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Bets file not found")

        with open(filepath, "r", encoding="utf-8") as f:
            bets = json.load(f)

        updated = False
        updated_bet = None
        for bet in bets:
            if bet.get("id") == bet_id:
                _apply_bet_settlement(bet, status)
                updated_bet = bet
                updated = True
                break

        if not updated:
            raise HTTPException(status_code=404, detail="Bet not found")

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(bets, f, ensure_ascii=False, indent=2)

        return {
            "status": "success",
            "message": "Bet settled successfully",
            "updated_bet": updated_bet,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/score-bets/settle")
def settle_exact_score_bets(daysFrom: int = Query(3, ge=1, le=7)):
    filepath = "data/bets.json"
    if not os.path.exists(filepath):
        return {"status": "success", "settled_count": 0, "message": "No bets file found"}

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            bets = json.load(f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    unsettled_score_bets = [
        bet for bet in bets
        if bet.get("bet_type") == "correct_score" and not bet.get("status")
    ]
    if not unsettled_score_bets:
        return {"status": "success", "settled_count": 0, "message": "No unsettled exact score bets"}

    sports = sorted({bet.get("sport_key") for bet in unsettled_score_bets if bet.get("sport_key")})
    if not sports:
        raise HTTPException(status_code=400, detail="Exact score bets are missing sport_key")

    client = get_client()
    result_map = {}
    try:
        for sport in sports:
            score_rows = parse_scores_data(client.get_scores(sport=sport, days_from=daysFrom))
            result_map.update(build_exact_score_result_map(score_rows))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc

    settled_count = 0
    settled_ids = []
    for bet in bets:
        if bet.get("bet_type") != "correct_score" or bet.get("status"):
            continue
        actual_score = result_map.get(bet.get("matchId"))
        if actual_score is None:
            continue

        bet["result_score"] = actual_score
        _apply_bet_settlement(
            bet,
            "win" if bet.get("selection") == actual_score else "lose",
        )
        settled_count += 1
        settled_ids.append(bet.get("id"))

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(bets, f, ensure_ascii=False, indent=2)

    return {
        "status": "success",
        "settled_count": settled_count,
        "settled_ids": settled_ids,
    }


@app.post("/bets/clear")
def clear_all_bets():
    filepath = "data/bets.json"
    cleared_count = 0

    try:
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                try:
                    bets = json.load(f)
                    if isinstance(bets, list):
                        cleared_count = len(bets)
                except json.JSONDecodeError:
                    cleared_count = 0

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)

        return {
            "status": "success",
            "message": "All bets cleared successfully",
            "cleared_count": cleared_count,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/bets/cancel")
async def cancel_bet(request: Request):
    filepath = "data/bets.json"
    try:
        body = await request.json()
        bet_id = body.get("id")
        if not bet_id:
            raise HTTPException(status_code=400, detail="Missing id")

        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Bets file not found")

        with open(filepath, "r", encoding="utf-8") as f:
            bets = json.load(f)

        remaining_bets = []
        canceled_bet = None
        for bet in bets:
            if canceled_bet is None and bet.get("id") == bet_id:
                canceled_bet = bet
                continue
            remaining_bets.append(bet)

        if canceled_bet is None:
            raise HTTPException(status_code=404, detail="Bet not found")
        if canceled_bet.get("status") not in {None, "unsettled"}:
            raise HTTPException(status_code=400, detail="Settled bets cannot be canceled")

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(remaining_bets, f, ensure_ascii=False, indent=2)

        return {
            "status": "success",
            "message": "Bet canceled successfully",
            "canceled_bet": canceled_bet,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
