import os

import requests
from dotenv import load_dotenv

load_dotenv()


class OddsAPIClient:
    BASE_URL = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key=None, timeout=10):
        self.api_key = api_key or os.getenv("ODDS_API_KEY")
        self.timeout = timeout
        if not self.api_key:
            raise ValueError("ODDS_API_KEY not found in environment")

    def _get(self, path, params):
        response = requests.get(
            f"{self.BASE_URL}{path}",
            params={**params, "apiKey": self.api_key},
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def get_sports(self):
        return self._get("/sports", {})

    def get_odds(self, sport="", regions="us,uk,au", markets="h2h,spreads,totals"):
        if not sport:
            raise ValueError("sport is required")
        return self._get(
            f"/sports/{sport}/odds",
            {
                "regions": regions,
                "markets": markets,
            },
        )
