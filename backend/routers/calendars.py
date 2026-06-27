from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import uuid

from routers.events import EventResponse
from routers.todos import TodoResponse

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/calendars", tags=["calendars"])

# データ型定義
class CalendarCreate(BaseModel):
    title: str

# 編集用
class CalendarUpdate(BaseModel):
    title: str

class CalendarResponse(BaseModel):
    id: uuid.UUID
    title: str
    owner_id: str

class CalendarDataResponse(BaseModel):
    events: List[EventResponse]
    todos: List[TodoResponse]

# APIエンドポイント

# カレンダーの新規作成 (POST)
@router.post("", response_model=CalendarResponse)
def create_calendar(
    calendar_data: CalendarCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_calendar = models.Calendar(title=calendar_data.title, owner_id=user_id)
    db.add(new_calendar)
    db.commit()
    db.refresh(new_calendar)
    return new_calendar

# カレンダー一覧取得 (GET)
@router.get("", response_model=List[CalendarResponse])
def get_calendars(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calendars = db.query(models.Calendar).filter(models.Calendar.owner_id == user_id).all()
    return calendars

# カレンダーの編集 (PATCH)
@router.patch("/{calendar_id}", response_model=CalendarResponse)
def update_calendar(
    calendar_id: uuid.UUID,
    calendar_data: CalendarUpdate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()

    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    # 権限確認
    if calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    # タイトルを更新
    calendar.title = calendar_data.title
    db.commit()
    db.refresh(calendar)

    return calendar

# カレンダーの削除 (DELETE)
@router.delete("/{calendar_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calendar(
    calendar_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()

    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    # 削除権限確認
    if calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="削除権限がありません")

    # 削除
    db.delete(calendar)
    db.commit()

    return

# カレンダーデータ取得 (GET)
@router.get("/{calendar_id}/data", response_model=CalendarDataResponse)
def get_calendar_data(
    calendar_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    if calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="このカレンダーのデータを閲覧する権限がありません")

    # Events
    events = db.query(models.Event).filter(models.Event.calendar_id == calendar_id).all()

    # ToDo
    todos = db.query(models.Todo).filter(models.Todo.calendar_id == calendar_id).all()

    return {
        "events": events,
        "todos": todos
    }