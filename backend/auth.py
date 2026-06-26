from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
import models

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> str:
    """
    開発用モック
    本来は Firebase のトークン (credentials.credentials) を検証
    """
    dummy_uid = "test_user_001"

    # ダミーユーザー確認
    user = db.query(models.User).filter(models.User.id == dummy_uid).first()

    if not user:
        user = models.User(id=dummy_uid, email="test@example.com")
        db.add(user)
        db.commit()
        db.refresh(user)

    return user.id