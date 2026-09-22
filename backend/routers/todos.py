from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_
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
    is_private: bool = False # 追加

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[datetime] = None
    assignments: Optional[Dict] = None
    tag_ids: Optional[List[uuid.UUID]] = None
    is_private: Optional[bool] = None # 追加

class TodoResponse(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    title: str
    due_date: Optional[datetime]
    assignments: Dict
    tag_ids: List[uuid.UUID] = []
    creator_id: str
    is_private: bool
    source: str                  # ← 追加
    external_id: Optional[str]   # ← 追加

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
        assignments=todo_data.assignments,
        creator_id=user_id,             # 追加
        is_private=todo_data.is_private # 追加
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

    if todo.source == "classroom" and todo_data.assignments is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Classroomの課題はアプリから完了状態を変更できません。Google Classroom上で提出してください。"
        )

    is_member = any(member.id == user_id for member in todo.calendar.members)
    if todo.calendar.owner_id != user_id and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="権限がありません")

    # 非公開ToDoの編集制限
    if todo.is_private and todo.creator_id != user_id and todo.calendar.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="他人の非公開ToDoは編集できません")

    if todo_data.title is not None:
        todo.title = todo_data.title
    if todo_data.due_date is not None:
        todo.due_date = todo_data.due_date
    if todo_data.is_private is not None:
        todo.is_private = todo_data.is_private
    if todo_data.tag_ids is not None:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(todo_data.tag_ids)).all()
        if len(tags) != len(todo_data.tag_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="一部のタグが見つかりません")
        todo.tags = tags

    # 辞書型の権限チェックと更新
    if todo_data.assignments is not None:
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        current_username = current_user.email.split("@")[0]

        valid_usernames = {todo.calendar.owner.email.split("@")[0]} | {m.email.split("@")[0] for m in todo.calendar.members}
        invalid_usernames = [uname for uname in todo_data.assignments.keys() if uname not in valid_usernames]
        if invalid_usernames:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="カレンダーに所属していないユーザーが割り当てられています")

        if todo.calendar.owner_id != user_id:
            for uname, status_data in todo_data.assignments.items():
                old_status = todo.assignments.get(uname, {})
                if isinstance(status_data, dict) and isinstance(old_status, dict):
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
        
    # カレンダーオーナー、または作成者本人のみ削除可能
    if todo.calendar.owner_id != user_id and todo.creator_id != user_id:
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

@router.get("", response_model=List[TodoResponse])
def get_all_todos(
    due_before: Optional[datetime] = Query(None, description="指定した日時以前の期限のToDoのみ取得"),
    include_no_due: bool = Query(True, description="期限なしのToDoを含めるか"),
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません")

    calendar_ids = {cal.id for cal in user.owned_calendars} | {cal.id for cal in user.shared_calendars}

    if not calendar_ids:
        return []

    # タイムゾーン情報を削除してDBと型を合わせる
    if due_before:
        due_before = due_before.replace(tzinfo=None)

    # クエリのベースを作成
    query = db.query(models.Todo).filter(models.Todo.calendar_id.in_(calendar_ids))

    # --- フィルタリングの適用 ---
    if due_before is not None:
        if include_no_due:
            # 期限が指定日時より前、または期限なし
            query = query.filter(or_(models.Todo.due_date <= due_before, models.Todo.due_date.is_(None)))
        else:
            # 期限が指定日時より前のみ（期限なしは除外）
            query = query.filter(models.Todo.due_date <= due_before)
    else:
        if not include_no_due:
            # 期限指定はないが、期限なしは除外する
            query = query.filter(models.Todo.due_date.is_not(None))

    todos = query.all()

    # 期日が近い順にソート（Noneは末尾へ）
    todos_sorted = sorted(
        todos,
        key=lambda x: (x.due_date is None, x.due_date)
    )

    todos_res = []
    for td in todos_sorted:
        calendar = td.calendar
        # マスキング判定
        if td.is_private and td.creator_id != user_id and calendar.owner_id != user_id:
            todos_res.append({
                "id": td.id,
                "calendar_id": td.calendar_id,
                "title": "予定あり",
                "due_date": td.due_date,
                "assignments": td.assignments,
                "tag_ids": [t.id for t in td.tags],
                "creator_id": td.creator_id,
                "is_private": True,
                "source": td.source,
                "external_id": td.external_id
            })
        else:
            todos_res.append({
                "id": td.id,
                "calendar_id": td.calendar_id,
                "title": td.title,
                "due_date": td.due_date,
                "assignments": td.assignments,
                "tag_ids": [t.id for t in td.tags],
                "creator_id": td.creator_id,
                "is_private": td.is_private,
                "source": td.source,
                "external_id": td.external_id
            })

    return todos_res