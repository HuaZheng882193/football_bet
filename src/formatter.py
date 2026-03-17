from rich.console import Console
from rich.table import Table
import translators as ts

def _translate(text):
    try:
        return ts.translate_text(text, translator="youdao", from_language="en", to_language="zh")
    except Exception:
        return text


def format_odds_table(matches):
    console = Console()

    for match in matches:
        home = _translate(match['home_team'])
        away = _translate(match['away_team'])
        local_time = match['commence_time'].astimezone().strftime("%Y-%m-%d %H:%M")
        table = Table(title=f"{local_time}  {home} vs {away}")
        table.add_column("博彩公司", style="cyan")
        table.add_column("主胜", style="green")
        table.add_column("平局", style="yellow")
        table.add_column("客胜", style="red")
        table.add_column("让球(主)", style="blue")
        table.add_column("让球(客)", style="magenta")
        table.add_column("大球", style="bright_green")
        table.add_column("小球", style="bright_red")

        for bm in match["bookmakers"]:
            spreads = bm.get("spreads", [])
            totals = bm.get("totals", [])
            home_spread = next((f"{o['point']} @ {o['price']}" for o in spreads if o["name"] == match["home_team"]), "-")
            away_spread = next((f"{o['point']} @ {o['price']}" for o in spreads if o["name"] == match["away_team"]), "-")
            over = next((f"{o['point']} @ {o['price']}" for o in totals if o["name"] == "Over"), "-")
            under = next((f"{o['point']} @ {o['price']}" for o in totals if o["name"] == "Under"), "-")
            table.add_row(
                bm["bookmaker"],
                str(bm["home"]) if bm["home"] else "-",
                str(bm["draw"]) if bm["draw"] else "-",
                str(bm["away"]) if bm["away"] else "-",
                home_spread,
                away_spread,
                over,
                under
            )

        console.print(table)
        console.print()
