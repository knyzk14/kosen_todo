from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import uuid

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/calendars", tags=["tags"])

# データ型定義
class TagCreate(BaseModel):
    name: str
    color_code: str

class TagResponse(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    name: str
    color_code: str

# APIエンドポイント

# 新しいタグを作成 (POST)
@router.post("/{calendar_id}/tags", response_model=TagResponse)
def create_tag(
    calendar_id: uuid.UUID,
    tag_data: TagCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()

    if not calendar or calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    # タグの作成
    new_tag = models.Tag(
        calendar_id=calendar_id,
        name=tag_data.name,
        color_code=tag_data.color_code
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag

# カレンダーのタグ一覧取得 (GET)
@router.get("/{calendar_id}/tags", response_model=List[TagResponse])
def get_tags(
    calendar_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()

    if not calendar or calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    tags = db.query(models.Tag).filter(models.Tag.calendar_id == calendar_id).all()
    return tags

# 3. タグの削除 (DELETE)
@router.delete("/api/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="タグが見つかりません")

    calendar = db.query(models.Calendar).filter(models.Calendar.id == tag.calendar_id).first()
    if calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    db.delete(tag)
    db.commit()