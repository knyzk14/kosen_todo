from fastapi import APIRouter

router = APIRouter(prefix="/api/websocket", tags=["websocket"])

@router.get("")
def get_websocket():
    return {"message": "WebSocket API Operation Check"}