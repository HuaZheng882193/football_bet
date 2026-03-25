from math import exp, factorial


MAX_GOALS = 4
HOUSE_EDGE = 0.88
MIN_PRICE = 4.0
MAX_PRICE = 80.0
SCORE_ENGINE_NAME = "Score Engine"


def _safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _poisson_probability(goals, lam):
    if lam <= 0:
        return 0.0
    return exp(-lam) * (lam**goals) / factorial(goals)


def _collect_h2h_prices(bookmakers, home_team, away_team):
    home_prices = []
    away_prices = []
    draw_prices = []

    for bookmaker in bookmakers or []:
        for market in bookmaker.get("markets", []):
            if market.get("key") != "h2h":
                continue
            for outcome in market.get("outcomes", []):
                price = _safe_float(outcome.get("price"))
                if price is None or price <= 1:
                    continue
                name = outcome.get("name")
                if name == home_team:
                    home_prices.append(price)
                elif name == away_team:
                    away_prices.append(price)
                elif name == "Draw":
                    draw_prices.append(price)

    return home_prices, away_prices, draw_prices


def _collect_totals_points(bookmakers):
    points = []
    for bookmaker in bookmakers or []:
        for market in bookmaker.get("markets", []):
            if market.get("key") != "totals":
                continue
            for outcome in market.get("outcomes", []):
                point = _safe_float(outcome.get("point"))
                if point is not None and 0.5 <= point <= 8:
                    points.append(point)
    return points


def _estimate_goal_expectation(event):
    bookmakers = event.get("bookmakers", [])
    home_team = event.get("home_team")
    away_team = event.get("away_team")

    home_prices, away_prices, draw_prices = _collect_h2h_prices(
        bookmakers,
        home_team,
        away_team,
    )
    total_points = _collect_totals_points(bookmakers)

    total_goals = sum(total_points) / len(total_points) if total_points else 2.7

    home_price = sum(home_prices) / len(home_prices) if home_prices else 2.3
    away_price = sum(away_prices) / len(away_prices) if away_prices else 2.9
    draw_price = sum(draw_prices) / len(draw_prices) if draw_prices else 3.2

    inv_home = 1 / home_price
    inv_draw = 1 / draw_price
    inv_away = 1 / away_price
    total_inv = inv_home + inv_draw + inv_away

    home_prob = inv_home / total_inv
    away_prob = inv_away / total_inv

    bias = (home_prob - away_prob) * 0.35
    home_share = min(0.78, max(0.22, 0.5 + bias))

    home_lambda = round(total_goals * home_share, 3)
    away_lambda = round(total_goals - home_lambda, 3)

    return {
        "home_lambda": home_lambda,
        "away_lambda": away_lambda,
        "total_goals": round(total_goals, 2),
    }


def _build_score_options(home_lambda, away_lambda):
    options = []
    for home_goals in range(MAX_GOALS + 1):
        for away_goals in range(MAX_GOALS + 1):
            probability = _poisson_probability(home_goals, home_lambda) * _poisson_probability(
                away_goals,
                away_lambda,
            )
            if probability <= 0:
                continue

            fair_price = 1 / probability
            adjusted_price = fair_price * HOUSE_EDGE
            price = round(min(MAX_PRICE, max(MIN_PRICE, adjusted_price)), 2)
            options.append(
                {
                    "score": f"{home_goals}:{away_goals}",
                    "home_goals": home_goals,
                    "away_goals": away_goals,
                    "probability": round(probability, 5),
                    "price": price,
                }
            )

    return options


def build_exact_score_markets(raw_events, include_options=True):
    markets = []
    for event in raw_events:
        expectation = _estimate_goal_expectation(event)
        options = []
        if include_options:
            options = _build_score_options(
                expectation["home_lambda"],
                expectation["away_lambda"],
            )
            options.sort(key=lambda item: (item["home_goals"], item["away_goals"]))

        markets.append(
            {
                "id": event["id"],
                "sport_key": event.get("sport_key"),
                "sport_title": event.get("sport_title"),
                "home_team": event.get("home_team"),
                "away_team": event.get("away_team"),
                "commence_time": event.get("commence_time"),
                "bookmaker": SCORE_ENGINE_NAME,
                "market_key": "correct_score",
                "market_label": "精确比分",
                "pricing_model": expectation,
                "options": options,
                "option_count": (MAX_GOALS + 1) ** 2,
            }
        )

    return markets


def build_exact_score_result_map(score_rows):
    result_map = {}
    for row in score_rows:
        if row.get("completed") and row.get("home_score") is not None and row.get("away_score") is not None:
            result_map[row["id"]] = f'{row["home_score"]}:{row["away_score"]}'
    return result_map
