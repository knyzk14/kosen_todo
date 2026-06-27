from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

from database import get_db
import models
from auth import get_current_user

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

# APIエンドポイント
@router.post("", response_model=EventResponse)
def create_event(
    event_data: EventCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    calendar = db.query(models.Calendar).filter(models.Calendar.id == event_data.calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    if calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="このカレンダーに予定を追加する権限がありません")

    # 保存
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

    return new_event