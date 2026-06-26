import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import ForeignKey, String, Text, DateTime, Boolean, Table, Column
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

# ===============================
# 中間テーブル
# ===============================

# 1. カレンダーとユーザーの共有関係管理
calendar_members = Table(
    "calendar_members",
    Base.metadata,
    Column(
        "calendar_id",
        ForeignKey("calendars.id", ondelete="CASCADE"),
        primary_key=True
    ),
    Column(
        "user_id",
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True
    ),
)

# 2. ToDoとタグの紐付け管理
todo_tags = Table(
    "todo_tags",
    Base.metadata,
    Column(
        "todo_id",
        ForeignKey("todos.id", ondelete="CASCADE"),
        primary_key=True
    ),
    Column(
        "tag_id",
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True
    ),
)


# ================================
# メインテーブル
# ================================

class User(Base):
    __tablename__ = "users"

    # FirebaseのUIDをそのまま主キーとして使用
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # リレーションシップ
    owned_calendars: Mapped[List["Calendar"]] = relationship(
        "Calendar", back_populates="owner", cascade="all, delete-orphan"
    )
    shared_calendars: Mapped[List["Calendar"]] = relationship(
        "Calendar", secondary=calendar_members, back_populates="members"
    )


class Calendar(Base):
    __tablename__ = "calendars"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    owner_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # リレーションシップ
    owner: Mapped["User"] = relationship("User", back_populates="owned_calendars")
    members: Mapped[List["User"]] = relationship(
        "User", secondary=calendar_members, back_populates="shared_calendars"
    )

    events: Mapped[List["Event"]] = relationship(
        "Event", back_populates="calendar", cascade="all, delete-orphan"
    )
    todos: Mapped[List["Todo"]] = relationship(
        "Todo", back_populates="calendar", cascade="all, delete-orphan"
    )
    tags: Mapped[List["Tag"]] = relationship(
        "Tag", back_populates="calendar", cascade="all, delete-orphan"
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("calendars.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # リレーションシップ
    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="events")


class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("calendars.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # リレーションシップ
    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="todos")
    # このToDoに紐付いているタグ一覧
    tags: Mapped[List["Tag"]] = relationship(
        "Tag", secondary=todo_tags, back_populates="todos"
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("calendars.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color_code: Mapped[str] = mapped_column(String(7), nullable=False) # 例: "#FF5733"

    # リレーションシップ
    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="tags")
    # このタグが付けられているToDo一覧
    todos: Mapped[List["Todo"]] = relationship(
        "Todo", secondary=todo_tags, back_populates="tags"
    )