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
):
    try:
        decoded_token = firebase_auth.verify_id_token(creds.credentials)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        
        # 追加: Firebaseのトークンから表示名と画像URLを取得
        display_name = decoded_token.get("name", "名称未設定")
        icon_url = decoded_token.get("picture")

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証トークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if email:
        domain = email.split("@")[-1]
        if domain not in ALLOWED_EMAIL_DOMAINS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"許可されていないドメインです: {domain}"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="メールアドレスが取得できません"
        )

    user = db.query(models.User).filter(models.User.id == uid).first()
    
    if not user:
        # 新規作成時に表示名とアイコンも保存
        user = models.User(
            id=uid, 
            email=email, 
            display_name=display_name, 
            icon_url=icon_url
        )
        db.add(user)
        db.flush()

        default_calendar = models.Calendar(
            title="マイカレンダー",
            owner_id=user.id,
            is_default=True
        )
        db.add(default_calendar)
        
        db.commit()
        db.refresh(user)
    else:
        # 既存ユーザーでも、情報が更新されていれば同期する
        if user.display_name != display_name or user.icon_url != icon_url:
            user.display_name = display_name
            user.icon_url = icon_url
            db.commit()

    return user.id