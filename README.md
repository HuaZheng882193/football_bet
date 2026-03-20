# Football Bet

足球赔率查询项目，当前包含三部分：

- 终端版 CLI
- 对外 HTTP API
- React 前端页面

## 1. 安装依赖

后端依赖：

```bash
pip install -r requirements.txt
```

前端依赖：

```bash
cd fronted
npm install
```

## 2. 配置 API Key

项目依赖环境变量 `ODDS_API_KEY`。

可以放在根目录 `.env`：

```env
ODDS_API_KEY=your_api_key_here
```

## 3. 启动 HTTP API

开发模式启动：

```bash
uvicorn api_server:app --host 0.0.0.0 --port 8000
```

或直接运行：

```bash
python api_server_main.py
```

接口：

- `GET /health`
- `GET /sports`
- `GET /odds?sport=soccer_epl`
- `GET /odds?sport=soccer_epl&regions=us&markets=h2h&parsed=false`

接口文档：

- `http://127.0.0.1:8000/docs`

## 4. 打包 HTTP API 为 EXE

安装 PyInstaller：

```bash
pip install pyinstaller
```

打包命令：

```bash
pyinstaller --clean football-api.spec
```

或直接执行：

```bat
build_api.bat
```

生成文件：

```text
dist/football-api.exe
```

运行方式：

```bash
set API_HOST=0.0.0.0
set API_PORT=8000
dist\football-api.exe
```

说明：

- 默认监听 `0.0.0.0:8000`
- 可以通过环境变量 `API_HOST` 和 `API_PORT` 覆盖
- 如果需要局域网访问，保留 `0.0.0.0`
- 如果需要公网访问，还要额外开放服务器端口和防火墙

## 5. 启动前端

前端默认请求：

```text
http://127.0.0.1:8000
```

如果后端地址不同，在 `fronted/.env.local` 中配置：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

开发模式启动：

```bash
cd fronted
npm run dev
```

生产构建：

```bash
cd fronted
npm run build
```

## 6. CLI 启动

```bash
python main.py
```

## 7. 获取 API Key

前往 [The Odds API](https://the-odds-api.com/) 注册并获取 API Key。
