from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict
import uuid

from database import get_db
import models
from auth import get_current_user
from routers.websocket import manager

router = APIRouter(prefix="/api/todos", tags=["todos"])

# データ型定義
class TodoCreate(BaseModel):
    calendar_id: uuid.UUID
    title: str
    due_date: Optional[datetime] = None
    tag_ids: List[uuid.UUID] = []
    assignments: Dict = {}

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[datetime] = None
    assignments: Optional[Dict] = None
    tag_ids: Optional[List[uuid.UUID]] = None

class TodoResponse(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    title: str
    due_date: Optional[datetime]
    assignments: Dict
    tag_ids: List[uuid.UUID] = []

# APIエンドポイント

# ToDoの新規作成 (POST)
@router.post("", response_model=TodoResponse)
def create_todo(
    todo_data: TodoCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == todo_data.calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カレンダーが見つかりません")

    is_member = any(member.id == user_id for member in calendar.members)
    if calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    if todo_data.assignments:
        valid_usernames = {calendar.owner.email.split("@")[0]} | {m.email.split("@")[0] for m in calendar.members}
        invalid_usernames = [uname for uname in todo_data.assignments.keys() if uname not in valid_usernames]
        if invalid_usernames:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="カレンダーに所属していないユーザーが割り当てられています")

    new_todo = models.Todo(
        calendar_id=todo_data.calendar_id,
        title=todo_data.title,
        due_date=todo_data.due_date,
        assignments=todo_data.assignments
    )

    if todo_data.tag_ids:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(todo_data.tag_ids)).all()
        if len(tags) != len(todo_data.tag_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="一部のタグが見つかりません")
        new_todo.tags = tags

    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)

    background_tasks.add_task(
        manager.broadcast,
        {"event": "todo_created", "id": str(new_todo.id)},
        str(todo_data.calendar_id)
    )

    return new_todo

# ToDoの編集 (PATCH)
@router.patch("/{todo_id}", response_model=TodoResponse)
def update_todo(
    todo_id: uuid.UUID,
    todo_data: TodoUpdate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    todo = db.query(models.Todo).filter(models.Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ToDoが見つかりません")

    is_member = any(member.id == user_id for member in todo.calendar.members)
    if todo.calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    if todo_data.title is not None:
        todo.title = todo_data.title
    if todo_data.due_date is not None:
        todo.due_date = todo_data.due_date
    if todo_data.tag_ids is not None:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(todo_data.tag_ids)).all()
        if len(tags) != len(todo_data.tag_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="一部のタグが見つかりません")
        todo.tags = tags

    # 辞書型の権限チェックと更新
    if todo_data.assignments is not None:
        # 現在の操作ユーザーのユーザー名を取得
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        current_username = current_user.email.split("@")[0]

        # バリデーション
        valid_usernames = {todo.calendar.owner.email.split("@")[0]} | {m.email.split("@")[0] for m in todo.calendar.members}
        invalid_usernames = [uname for uname in todo_data.assignments.keys() if uname not in valid_usernames]
        if invalid_usernames:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="カレンダーに所属していないユーザーが割り当てられています")

        if todo.calendar.owner_id != user_id:
            for uname, status_data in todo_data.assignments.items():
                old_status = todo.assignments.get(uname, {})
                if isinstance(status_data, dict) and isinstance(old_status, dict):
                    # 変更: UIDではなくユーザー名(uname)で自身の完了状態か判定する
                    if old_status.get("completed") != status_data.get("completed") and uname != current_username:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="他人の完了状態は変更できません"
                        )
        todo.assignments = todo_data.assignments

    db.commit()
    db.refresh(todo)

    background_tasks.add_task(
        manager.broadcast,
        {"event": "todo_updated", "id": str(todo.id)},
        str(todo.calendar_id)
    )

    return todo

# ToDoの削除 (DELETE)
@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    todo = db.query(models.Todo).filter(models.Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ToDoが見つかりません")
    if todo.calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="削除権限がありません")

    calendar_id = todo.calendar_id

    db.delete(todo)
    db.commit()

    background_tasks.add_task(
        manager.broadcast,
        {"event": "todo_deleted", "id": str(todo_id)},
        str(calendar_id)
    )

    return