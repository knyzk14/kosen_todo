from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import requests
from datetime import datetime, timezone

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/classroom", tags=["classroom"])

class SyncRequest(BaseModel):
    access_token: str

@router.post("/sync")
def sync_classroom_todos(
    request_data: SyncRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ユーザーとデフォルトカレンダーの取得
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません")
        
    default_calendar = db.query(models.Calendar).filter(
        models.Calendar.owner_id == user_id, 
        models.Calendar.is_default == True
    ).first()
    
    if not default_calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="デフォルトカレンダーが見つかりません")

    headers = {
        "Authorization": f"Bearer {request_data.access_token}"
    }

    # 1. 有効なコース（授業）一覧の取得
    courses_url = "https://classroom.googleapis.com/v1/courses"
    courses_res = requests.get(courses_url, headers=headers, params={"courseStates": "ACTIVE"})
    
    if courses_res.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Classroomからのコース取得に失敗しました。アクセストークンまたはスコープを確認してください。")
        
    courses_data = courses_res.json()
    courses = courses_data.get("courses", [])

    username = user.email.split("@")[0]
    synced_count = 0

    for course in courses:
        course_id = course["id"]
        # どの授業の課題か分かるようにタイトルにコース名を含める
        course_name = course.get("name", "名称未設定コース")
        
        # 2. 各コースの課題 (courseWork) を取得
        cw_url = f"https://classroom.googleapis.com/v1/courses/{course_id}/courseWork"
        cw_res = requests.get(cw_url, headers=headers)
        if cw_res.status_code != 200:
            continue
            
        cw_data = cw_res.json()
        course_works = cw_data.get("courseWork", [])
        
        for cw in course_works:
            cw_id = cw["id"]
            title = f"[{course_name}] {cw.get('title', '無題の課題')}"
            
            # 期日の計算
            due_date_info = cw.get("dueDate")
            due_time_info = cw.get("dueTime")
            
            naive_due_date = None
            if due_date_info:
                year = due_date_info.get("year")
                month = due_date_info.get("month")
                day = due_date_info.get("day")
                hours = due_time_info.get("hours", 0) if due_time_info else 0
                minutes = due_time_info.get("minutes", 0) if due_time_info else 0
                
                due_datetime = datetime(year, month, day, hours, minutes, tzinfo=timezone.utc)
                naive_due_date = due_datetime.replace(tzinfo=None)
                
            # 3. データベースへの反映 (Upsert処理)
            existing_todo = db.query(models.Todo).filter(
                models.Todo.calendar_id == default_calendar.id,
                models.Todo.source == "classroom",
                models.Todo.external_id == cw_id
            ).first()
            if existing_todo:
                existing_todo.title = title
                existing_todo.due_date = naive_due_date
            else:
                new_todo = models.Todo(
                    calendar_id=default_calendar.id,
                    title=title,
                    assignments={username: {"assigned": True, "completed": False}},
                    creator_id=user_id,
                    is_private=True,
                    source="classroom",
                    external_id=cw_id
                )
                db.add(new_todo)
            
            synced_count += 1
            
    db.commit()

    return {"message": "同期完了", "synced_count": synced_count}