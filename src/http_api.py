from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from requests import HTTPError

from api_client import OddsAPIClient
from data_parser import parse_odds_data

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
        return client.get_sports()
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

    return parse_odds_data(raw_data)
