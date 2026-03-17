# 足球赔率查询程序

## 安装

```bash
cd football-odds
pip install -r requirements.txt
```

## 配置

1. 复制 `.env.example` 为 `.env`
2. 在 [The Odds API](https://the-odds-api.com/) 注册获取免费 API Key
3. 将 API Key 填入 `.env` 文件

## 使用

```bash
# 查询英超赔率
python src/cli.py query --league soccer_epl

# 查看所有足球联赛
python src/cli.py sports
```

## 可用联赛代码

- `soccer_epl` - 英超
- `soccer_spain_la_liga` - 西甲
- `soccer_germany_bundesliga` - 德甲
- `soccer_italy_serie_a` - 意甲
- `soccer_france_ligue_one` - 法甲
