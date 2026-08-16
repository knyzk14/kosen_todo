import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from datetime import datetime

from database import engine
import models
from routers import calendars, events, tags, todos, websocket

API_VERSION = "1.4.1"

# Cloudflareを経由した際の実IPを取得
def get_real_ip(request: Request):
    return request.headers.get("cf-connecting-ip", get_remote_address(request))

# 1分間に300リクエスト
limiter = Limiter(key_func=get_real_ip, default_limits=["300/minute"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時データベースのテーブルが存在しなければ作成
    models.Base.metadata.create_all(bind=engine)
    yield

is_prod = os.environ.get("ENVIRONMENT") == "production"

app = FastAPI(
    title="Kosen Todo API",
    lifespan=lifespan,
    version=API_VERSION,
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json")

# レートリミットの設定をアプリに登録
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

allowed_origins_raw = os.environ.get("ALLOWED_ORIGINS", "")

origins = [
    origin.strip()
    for origin in allowed_origins_raw.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # 認証情報の送信を許可
    allow_methods=["*"],     # 全てのHTTPメソッドを許可
    allow_headers=["*"],     # 全てのHTTPヘッダーを許可
)

@app.get("/api/ping", tags=["health"])
def ping():
    return {
        "status": "ok",
        "message": "pong",
        "version": app.version,
        "environment": "production" if is_prod else "development",
        "timestamp": datetime.now().isoformat()
    }

# ルーター登録
app.include_router(calendars.router)
app.include_router(events.router)
app.include_router(tags.router)
app.include_router(todos.router)
app.include_router(websocket.router)

# frontendの提供
app.mount("/", StaticFiles(directory="static", html=True), name="static")