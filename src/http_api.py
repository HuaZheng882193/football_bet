import json
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from requests import HTTPError

from api_client import OddsAPIClient
from data_parser import parse_odds_data
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
        payout = _round_money(stake * price)
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

@app.post("/bet")
async def save_bet(request: Request):
    try:
        data = await request.json()
        filepath = "bets.json"
        
        bets = []
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                try:
                    bets = json.load(f)
                except json.JSONDecodeError:
                    bets = []

        data.setdefault("status", None)
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
    filepath = "bets.json"
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

        filepath = "bets.json"
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


@app.post("/bets/clear")
def clear_all_bets():
    filepath = "bets.json"
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
