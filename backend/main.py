from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from database import engine
import models
from routers import calendars, events, tags, todos, websocket

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時データベースのテーブルが存在しなければ作成
    models.Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(lifespan=lifespan)

# ルーター登録
app.include_router(calendars.router)
app.include_router(events.router)
app.include_router(tags.router)
app.include_router(todos.router)
app.include_router(websocket.router)

# frontendの提供
app.mount("/", StaticFiles(directory="static", html=True), name="static")