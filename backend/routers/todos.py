from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/todos", tags=["todos"])

# データ型定義
class TodoCreate(BaseModel):
    calendar_id: uuid.UUID
    title: str
    due_date: Optional[datetime] = None

class TodoResponse(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    title: str
    due_date: Optional[datetime]
    is_completed: bool

# APIエンドポイント
@router.post("", response_model=TodoResponse)
def create_todo(
    todo_data: TodoCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    calendar = db.query(models.Calendar).filter(models.Calendar.id == todo_data.calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")
    if calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="このカレンダーにToDoを追加する権限がありません")

    # 保存
    new_todo = models.Todo(
        calendar_id=todo_data.calendar_id,
        title=todo_data.title,
        due_date=todo_data.due_date
    )
    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)

    return new_todo