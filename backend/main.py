from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import engine
import models
from routers import calendars, events, tags, todos, websocket

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時データベースのテーブルが存在しなければ作成
    models.Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Kosen Todo API", lifespan=lifespan)

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

# ルーター登録
app.include_router(calendars.router)
app.include_router(events.router)
app.include_router(tags.router)
app.include_router(todos.router)
app.include_router(websocket.router)

# frontendの提供
app.mount("/", StaticFiles(directory="static", html=True), name="static")