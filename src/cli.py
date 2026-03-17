from api_client import OddsAPIClient
from data_parser import parse_odds_data
from formatter import format_odds_table
import translators as ts


def translate_to_en(text):
    try:
        return ts.translate_text(text, translator="youdao", from_language="zh", to_language="en")
    except Exception:
        return text


def main():
    print("--------------------------------")
    print("|    足球比赛赔率查询程序     |")
    print("--------------------------------")
    client = OddsAPIClient()

    # 1. 只获取一次体育项目
    print("\n正在获取可用体育项目...\n")
    sports_list = client.get_sports()
    print(f"{'Key':<40} {'名称'}")
    print("-" * 70)
    for sport in sports_list:
        print(f"{sport['key']:<40} {sport['title']}")

    # 2. 输入 sport key
    print()
    sport_key = input("请输入 sport key: ").strip()
    if not sport_key:
        print("未输入 sport key，退出。")
        return

    # 3. 循环查询
    while True:
        team = input("\n请输入球队名（直接回车显示所有比赛，输入 q 退出）: ").strip()
        if team.lower() == "q":
            print("退出。")
            break

        print("\n正在获取赔率数据...\n")
        raw_data = client.get_odds(sport=sport_key)
        matches = parse_odds_data(raw_data)

        if team:
            team_en = translate_to_en(team)
            team_upper = team_en.upper()
            matches = [
                m for m in matches
                if team_upper in m["home_team"].upper() or team_upper in m["away_team"].upper()
            ]
            if not matches:
                print(f"未找到包含 '{team}'（英文：{team_en}）的比赛")
                continue

        format_odds_table(matches)


if __name__ == "__main__":
    main()
