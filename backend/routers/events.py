from fastapi import APIRouter

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("")
def get_events():
    return {"message": "Event Acquisition API Operation Check"}