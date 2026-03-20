#!/usr/bin/env python3
import os
import sys

import uvicorn

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from http_api import app


def main():
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
