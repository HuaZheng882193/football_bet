import json
import os
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

        if not bet_id or not status:
            raise HTTPException(status_code=400, detail="Missing id or status")

        filepath = "bets.json"
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Bets file not found")

        with open(filepath, "r", encoding="utf-8") as f:
            bets = json.load(f)

        updated = False
        for bet in bets:
            if bet.get("id") == bet_id:
                bet["status"] = status
                updated = True
                break

        if not updated:
            raise HTTPException(status_code=404, detail="Bet not found")

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(bets, f, ensure_ascii=False, indent=2)

        return {"status": "success", "message": "Bet settled successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
