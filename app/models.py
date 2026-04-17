from datetime import datetime
from typing import Optional, List, Any, TYPE_CHECKING
from sqlalchemy import String, Integer, Text, JSON, DateTime, Boolean, ForeignKey, UniqueConstraint, MetaData, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, declarative_base
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.dialects.postgresql import ARRAY

metadata = MetaData()

Base = declarative_base(metadata=metadata)


class User(Base, AsyncAttrs):
    __tablename__ = 'users'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    
    bluesky_accounts: Mapped[List["BlueskyAccount"]] = relationship(
        "BlueskyAccount", back_populates="user_ref", lazy="selectin"
    )


class BlueskyAccount(Base, AsyncAttrs):
    __tablename__ = 'bluesky_account'
    __table_args__ = (
        Index('ix_bluesky_account_user_id', 'user_id'),
        UniqueConstraint('user_id', 'did', name='uq_bluesky_account_user_did'),
    )
    
    did: Mapped[str] = mapped_column(String(128), primary_key=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    password: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id'), nullable=True)
    
    user_ref: Mapped[Optional["User"]] = relationship("User", back_populates="bluesky_accounts")
    scheduled_posts: Mapped[List["ScheduledPost"]] = relationship(
        "ScheduledPost", back_populates="account_ref", lazy="selectin"
    )


class AppSettings(Base, AsyncAttrs):
    __tablename__ = 'app_settings'
    __table_args__ = (
        Index('ix_app_settings_user_id', 'user_id'),
    )

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id'), primary_key=True, nullable=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)


class ScheduledPost(Base, AsyncAttrs):
    __tablename__ = 'scheduled_post'
    __table_args__ = (
        Index('ix_scheduled_post_user_id', 'user_id'),
        Index('ix_scheduled_post_schedule_time', 'schedule_time'),
        Index('ix_scheduled_post_status', 'status'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    account_did: Mapped[str] = mapped_column(String(128), ForeignKey('bluesky_account.did', ondelete='CASCADE'), nullable=False)
    account_username: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    langs: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    schedule_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    image_data: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    labels: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    parent_post_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey('scheduled_post.id', ondelete='CASCADE'), nullable=True)
    external_reply_uri: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    external_reply_cid: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    post_uri: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    post_cid: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reply_gate: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    disable_quotes: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_quote: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    account_ref: Mapped["BlueskyAccount"] = relationship("BlueskyAccount", back_populates="scheduled_posts")


class HashtagUsage(Base, AsyncAttrs):
    __tablename__ = 'hashtag_usage'
    __table_args__ = (
        UniqueConstraint('account_username', 'tag', name='_account_tag_uc'),
        Index('ix_hashtag_usage_user_id', 'user_id'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_username: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    tag: Mapped[str] = mapped_column(String(255), nullable=False)
    last_used: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    status: Mapped[str] = mapped_column(String(50), default='active', nullable=False)


class ErrorLog(Base, AsyncAttrs):
    __tablename__ = 'error_logs'
    __table_args__ = (
        Index('ix_error_log_user_id', 'user_id'),
        Index('ix_error_log_created_at', 'created_at'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    error_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    post_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    account_did: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
