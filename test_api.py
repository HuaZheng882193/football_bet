import requests
import json

def test():
    # Test valid win
    r1 = requests.post("http://127.0.0.1:8000/bets/settle", json={"id":"bet_1774357576773","status":"win"})
    print("Test 1 (win):", r1.status_code, r1.text)

    # Test null status
    r2 = requests.post("http://127.0.0.1:8000/bets/settle", json={"id":"bet_1774357576773","status":None})
    print("Test 2 (null):", r2.status_code, r2.text)

    # Test non-existent ID
    r3 = requests.post("http://127.0.0.1:8000/bets/settle", json={"id":"invalid_id","status":"win"})
    print("Test 3 (invalid id):", r3.status_code, r3.text)

test()
