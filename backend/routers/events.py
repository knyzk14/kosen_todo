from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

from database import get_db
import models
from auth import get_current_user
from routers.websocket import manager

router = APIRouter(prefix="/api/events", tags=["events"])

# データ型定義
class EventCreate(BaseModel):
    calendar_id: uuid.UUID
    title: str
    description: Optional[str] = None
    start_at: datetime
    end_at: datetime

class EventResponse(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    title: str
    description: Optional[str]
    start_at: datetime
    end_at: datetime

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None

# APIエンドポイント
@router.post("", response_model=EventResponse)
def create_event(
    event_data: EventCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == event_data.calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    is_member = any(member.id == user_id for member in calendar.members)
    if calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    new_event = models.Event(
        calendar_id=event_data.calendar_id,
        title=event_data.title,
        description=event_data.description,
        start_at=event_data.start_at,
        end_at=event_data.end_at
    )

    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    background_tasks.add_task(
        manager.broadcast,
        {"event": "event_created", "id": str(new_event.id)},
        str(event_data.calendar_id)
    )

    return new_event

# 予定の編集 (PATCH)
@router.patch("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: uuid.UUID,
    event_data: EventUpdate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="予定が見つかりません")

    calendar = db.query(models.Calendar).filter(models.Calendar.id == event.calendar_id).first()
    is_member = any(member.id == user_id for member in calendar.members)

    if calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    if event_data.title is not None:
        event.title = event_data.title
    if event_data.description is not None:
        event.description = event_data.description
    if event_data.start_at is not None:
        event.start_at = event_data.start_at
    if event_data.end_at is not None:
        event.end_at = event_data.end_at

    db.commit()
    db.refresh(event)

    background_tasks.add_task(
        manager.broadcast,
        {"event": "event_updated", "id": str(event.id)},
        str(event.calendar_id)
    )

    return event

# 予定の削除 (DELETE)
@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="予定が見つかりません")

    calendar = db.query(models.Calendar).filter(models.Calendar.id == event.calendar_id).first()
    is_member = any(member.id == user_id for member in calendar.members)

    if calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    calendar_id = event.calendar_id

    db.delete(event)
    db.commit()

    background_tasks.add_task(
        manager.broadcast,
        {"event": "event_deleted", "id": str(event_id)},
        str(calendar_id)
    )