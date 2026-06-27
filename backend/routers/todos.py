from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
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
    tag_ids: List[uuid.UUID] = []

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[datetime] = None
    is_completed: Optional[bool] = None
    tag_ids: Optional[List[uuid.UUID]] = None

class TodoResponse(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    title: str
    due_date: Optional[datetime]
    is_completed: bool
    tag_ids: List[uuid.UUID] = []

# APIエンドポイント

# ToDoの新規作成 (POST)
@router.post("", response_model=TodoResponse)
def create_todo(
    todo_data: TodoCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    calendar = db.query(models.Calendar).filter(models.Calendar.id == todo_data.calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    is_member = any(member.id == user_id for member in calendar.members)

    if calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    # 保存
    new_todo = models.Todo(
        calendar_id=todo_data.calendar_id,
        title=todo_data.title,
        due_date=todo_data.due_date
    )

    if todo_data.tag_ids:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(todo_data.tag_ids)).all()
        if len(tags) != len(todo_data.tag_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="一部のタグが見つかりません")
        new_todo.tags = tags

    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)

    return new_todo

# ToDoの編集 (PATCH)
@router.patch("/{todo_id}", response_model=TodoResponse)
def update_todo(
    todo_id: uuid.UUID,
    todo_data: TodoUpdate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    todo = db.query(models.Todo).filter(models.Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ToDoが見つかりません")

    is_member = any(member.id == user_id for member in todo.calendar.members)

    if todo.calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    # 更新
    todo.title = todo_data.title
    todo.due_date = todo_data.due_date
    todo.is_completed = todo_data.is_completed

@router.post("", response_model=TodoResponse)
def create_todo(
    todo_data: TodoCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    calendar = db.query(models.Calendar).filter(models.Calendar.id == todo_data.calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    is_member = any(member.id == user_id for member in calendar.members)

    if calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    # 保存
    new_todo = models.Todo(
        calendar_id=todo_data.calendar_id,
        title=todo_data.title,
        due_date=todo_data.due_date
    )

    if todo_data.tag_ids:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(todo_data.tag_ids)).all()
        if len(tags) != len(todo_data.tag_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="一部のタグが見つかりません")
        new_todo.tags = tags

    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)

    return new_todo

# ToDoの編集 (PATCH)
@router.patch("/{todo_id}", response_model=TodoResponse)
def update_todo(
    todo_id: uuid.UUID,
    todo_data: TodoUpdate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    todo = db.query(models.Todo).filter(models.Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ToDoが見つかりません")

    is_member = any(member.id == user_id for member in todo.calendar.members)

    if todo.calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    # 更新
    if todo_data.title is not None:
        todo.title = todo_data.title
    if todo_data.due_date is not None:
        todo.due_date = todo_data.due_date
    if todo_data.is_completed is not None:
        todo.is_completed = todo_data.is_completed
    if todo_data.tag_ids is not None:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(todo_data.tag_ids)).all()
        if len(tags) != len(todo_data.tag_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="一部のタグが見つかりません")
        todo.tags = tags

    db.commit()
    db.refresh(todo)

    return todo


# ToDoの削除 (DELETE)
@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    todo = db.query(models.Todo).filter(models.Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ToDoが見つかりません")
    if todo.calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="削除権限がありません")

    db.delete(todo)
    db.commit()