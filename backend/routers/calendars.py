from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uuid

from routers.events import EventResponse
from routers.todos import TodoResponse
from routers.websocket import manager

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/calendars", tags=["calendars"])

# データ型定義
class CalendarCreate(BaseModel):
    title: str

class CalendarUpdate(BaseModel):
    title: Optional[str] = None
    member_usernames: Optional[List[str]] = None

class UserResponse(BaseModel):
    username: str
    email: str

class CalendarResponse(BaseModel):
    id: uuid.UUID
    title: str
    owner_username: str
    members: List[str] = []
    event_count: int = 0
    todo_count: int = 0

class CalendarDataResponse(BaseModel):
    events: List[EventResponse]
    todos: List[TodoResponse]

# APIエンドポイント

# カレンダーの新規作成 (POST)
@router.post("", response_model=CalendarResponse)
def create_calendar(
    calendar_data: CalendarCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_calendar = models.Calendar(title=calendar_data.title, owner_id=user_id)
    db.add(new_calendar)
    db.commit()
    db.refresh(new_calendar)

    user = db.query(models.User).filter(models.User.id == user_id).first()
    owner_username = user.email.split("@")[0]

    return {
        "id": new_calendar.id,
        "title": new_calendar.title,
        "owner_username": owner_username,
        "members": [],
        "event_count": 0,
        "todo_count": 0
    }

# カレンダー一覧取得 (GET)
@router.get("", response_model=List[CalendarResponse])
def get_calendars(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    calendars = db.query(models.Calendar).filter(
        or_(
            models.Calendar.owner_id == user_id,
            models.Calendar.members.any(id=user_id)
        )
    ).all()

    result = []
    for cal in calendars:
        owner_username = cal.owner.email.split("@")[0]
        members = [m.email.split("@")[0] for m in cal.members]
        result.append({
            "id": cal.id,
            "title": cal.title,
            "owner_username": owner_username,
            "members": members,
            "event_count": len(cal.events),
            "todo_count": len(cal.todos)
        })

    return result

# カレンダーの編集 (PATCH)
@router.patch("/{calendar_id}", response_model=CalendarResponse)
def update_calendar(
    calendar_id: uuid.UUID,
    calendar_data: CalendarUpdate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()

    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")
    if calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    if calendar_data.title is not None:
        calendar.title = calendar_data.title

    if calendar_data.member_usernames is not None:
        unique_usernames = list(set(calendar_data.member_usernames))
        users = []
        for username in unique_usernames:
            # 「ユーザー名@」で前方一致検索を行う
            user = db.query(models.User).filter(models.User.email.startswith(f"{username}@")).first()
            if user and user.id != calendar.owner_id:
                users.append(user)

        calendar.members = users

    db.commit()
    db.refresh(calendar)

    background_tasks.add_task(
        manager.broadcast,
        {"event": "calendar_updated", "id": str(calendar.id)},
        str(calendar.id)
    )

    owner_username = calendar.owner.email.split("@")[0]
    members = [m.email.split("@")[0] for m in calendar.members]

    return {
        "id": calendar.id,
        "title": calendar.title,
        "owner_username": owner_username,
        "members": members,
        "event_count": len(calendar.events),
        "todo_count": len(calendar.todos)
    }

# カレンダーの削除 (DELETE)
@router.delete("/{calendar_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calendar(
    calendar_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()

    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    if calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="削除権限がありません")

    db.delete(calendar)
    db.commit()

    background_tasks.add_task(
        manager.broadcast,
        {"event": "calendar_deleted", "id": str(calendar_id)},
        str(calendar_id)
    )

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

    is_member = any(member.id == user_id for member in calendar.members)
    if calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    events = db.query(models.Event).filter(models.Event.calendar_id == calendar_id).all()
    todos = db.query(models.Todo).filter(models.Todo.calendar_id == calendar_id).all()

    return {
        "events": events,
        "todos": todos
    }

# カレンダーからの脱退 (DELETE)
@router.delete("/{calendar_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_calendar(
    calendar_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()

    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")
    if calendar.owner_id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="オーナーは脱退できません。カレンダーを削除してください。")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user in calendar.members:
        calendar.members.remove(user)
        db.commit()

    background_tasks.add_task(
        manager.broadcast,
        {"event": "calendar_updated", "id": str(calendar_id)},
        str(calendar_id)
    )

    return