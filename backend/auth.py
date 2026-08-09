import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

from database import get_db
import models

security = HTTPBearer()

if not firebase_admin._apps:
    cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Firebase初期化エラー: {e}")


ALLOWED_EMAIL_DOMAINS = [
    d.strip() for d in os.environ.get("ALLOWED_EMAIL_DOMAINS", "").split(",") if d.strip()
]

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> str:
    try:
        decoded_token = firebase_auth.verify_id_token(creds.credentials)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")

        if not uid:
            raise ValueError("トークンにUIDが含まれていません")

        # ドメイン制限のチェック
        if email and ALLOWED_EMAIL_DOMAINS:
            domain = email.split("@")[-1]
            if domain not in ALLOWED_EMAIL_DOMAINS:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="許可されていないメールアドレスのドメインです"
                )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証情報です",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.id == uid).first()

    if not user:
        user = models.User(id=uid, email=email or "no-email@example.com")
        db.add(user)
        db.commit()
        db.refresh(user)

    return user.id