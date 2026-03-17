import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from api_client import OddsAPIClient

def test_api_client():
    os.environ["ODDS_API_KEY"] = "test_key"
    client = OddsAPIClient()
    assert client.api_key == "test_key"
