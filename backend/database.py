import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

DATABASE_URL = os.environ.get("DATABASE_URL")

# データベースエンジンの作成
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

# セッション工場の作成
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# FastAPI用の依存関係関数
def get_db():
    """
    Generator function that creates a database session for each request and closes it when processing is complete.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()