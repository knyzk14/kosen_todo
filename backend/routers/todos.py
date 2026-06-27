from fastapi import APIRouter

router = APIRouter(prefix="/api/todos", tags=["todos"])

@router.get("")
def get_todos():
    return {"message": "Todo Acquisition API Operation Check"}