from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/freebusy", tags=["freebusy"])

class FreeBusyRequest(BaseModel):
    usernames: List[str]
    start_at: datetime
    end_at: datetime

class TimeSlot(BaseModel):
    start_at: datetime
    end_at: datetime

class FreeBusyResponse(BaseModel):
    free_slots: List[TimeSlot]

@router.post("", response_model=FreeBusyResponse)
def get_free_time(
    request_data: FreeBusyRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if request_data.start_at >= request_data.end_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="開始日時は終了日時より前である必要があります")

    target_users = []
    for uname in request_data.usernames:
        user = db.query(models.User).filter(models.User.email.startswith(f"{uname}@")).first()
        if user:
            target_users.append(user)

    if not target_users:
        return {"free_slots": [{"start_at": request_data.start_at, "end_at": request_data.end_at}]}

    calendar_ids = set()
    for user in target_users:
        for cal in user.owned_calendars:
            calendar_ids.add(cal.id)
        for cal in user.shared_calendars:
            calendar_ids.add(cal.id)

    if not calendar_ids:
        return {"free_slots": [{"start_at": request_data.start_at, "end_at": request_data.end_at}]}

    events = db.query(models.Event).filter(
        models.Event.calendar_id.in_(calendar_ids),
        models.Event.start_at < request_data.end_at,
        models.Event.end_at > request_data.start_at
    ).all()

    busy_intervals = []
    for ev in events:
        ev_start = max(ev.start_at, request_data.start_at)
        ev_end = min(ev.end_at, request_data.end_at)
        if ev_start < ev_end:
            busy_intervals.append((ev_start, ev_end))

    busy_intervals.sort(key=lambda x: x[0])

    merged_busy = []
    for interval in busy_intervals:
        if not merged_busy:
            merged_busy.append(interval)
        else:
            last_start, last_end = merged_busy[-1]
            if interval[0] <= last_end:
                merged_busy[-1] = (last_start, max(last_end, interval[1]))
            else:
                merged_busy.append(interval)

    free_slots = []
    current_time = request_data.start_at

    for start, end in merged_busy:
        if current_time < start:
            free_slots.append({"start_at": current_time, "end_at": start})
        current_time = max(current_time, end)

    if current_time < request_data.end_at:
        free_slots.append({"start_at": current_time, "end_at": request_data.end_at})

    return {"free_slots": free_slots}