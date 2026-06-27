from fastapi import APIRouter

router = APIRouter(prefix="/api/tags", tags=["tags"])

@router.get("")
def get_tags():
    return {"message": "Tag Acquisition API Operation Check"}