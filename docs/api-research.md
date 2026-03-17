# API 选型报告

## 选择：The Odds API

### 优势
- 免费层：每月 500 次请求
- 支持主流足球联赛（英超、西甲、德甲等）
- 实时赔率数据
- 多家博彩公司对比

### API 端点
- `GET /v4/sports` - 获取所有体育项目
- `GET /v4/sports/{sport}/odds` - 获取赔率数据

### 注册地址
https://the-odds-api.com/

### 示例响应
```json
[
  {
    "id": "abc123",
    "home_team": "Manchester United",
    "away_team": "Liverpool",
    "commence_time": "2026-03-20T15:00:00Z",
    "bookmakers": [
      {
        "title": "Bet365",
        "markets": [
          {
            "key": "h2h",
            "outcomes": [
              {"name": "Manchester United", "price": 2.5},
              {"name": "Draw", "price": 3.2},
              {"name": "Liverpool", "price": 2.8}
            ]
          }
        ]
      }
    ]
  }
]
```
