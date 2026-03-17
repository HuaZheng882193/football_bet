# Football Bet - 足球赔率查询工具

## 打包为 EXE 文件

### 前置要求

- Python 3.8+
- 已安装依赖：`pip install -r requirements.txt`
- 安装 PyInstaller：`pip install pyinstaller`

### 打包命令

在项目根目录运行：

```bash
pyinstaller --onefile --name football-odds main.py
```

打包完成后，exe 文件生成在 `dist/football-odds.exe`。

### 将附件一并放入 dist 目录

打包后把以下文件复制到 `dist/` 目录中，与 exe 放在一起：

- `set_api_key.bat` — 用于设置 API Key 的脚本
- `赛事key对照列表.xlsx` — 赛事代码对照表
- `操作教程.docx` — 使用说明

### 使用方式

1. 首次使用先运行 `set_api_key.bat`，输入你的 API Key
2. 运行 `football-odds.exe` 启动程序

### 获取 API Key

前往 [The Odds API](https://the-odds-api.com/) 注册并获取免费 API Key。
