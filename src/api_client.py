import os
import requests
from dotenv import load_dotenv

load_dotenv()

class OddsAPIClient:
    BASE_URL = "https://api.the-odds-api.com/v4"

    def __init__(self):
        self.api_key = os.getenv("ODDS_API_KEY")
        if not self.api_key:
            raise ValueError("ODDS_API_KEY not found in environment")

    def get_sports(self):
        url = f"{self.BASE_URL}/sports"
        params = {"apiKey": self.api_key}
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()

    def get_odds(self, sport="", regions="us,uk,au", markets="h2h,spreads,totals"):
        url = f"{self.BASE_URL}/sports/{sport}/odds"
        params = {
            "apiKey": self.api_key,
            "regions": regions,
            "markets": markets
        }
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
