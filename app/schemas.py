from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AccountCreate(BaseModel):
    identifier: str
    password: str


class AccountResponse(BaseModel):
    did: str
    username: str
    display_name: Optional[str] = None


class PostCreate(BaseModel):
    account_did: str
    content: str
    schedule_time: Optional[str] = None
    language: Optional[str] = 'ja'
    image_data: Optional[List[dict]] = None
    labels: Optional[List[str]] = None
    parent_post_id: Optional[str] = None
    external_reply_uri: Optional[str] = None
    external_reply_cid: Optional[str] = None
    reply_gate: Optional[List[str]] = None
    disable_quotes: Optional[bool] = False
    is_quote: Optional[bool] = False


class PostResponse(BaseModel):
    id: str
    account: Optional[str] = None
    content: str
    langs: List[str]
    schedule_time: Optional[str] = None
    labels: List[str] = []
    status: str
    image_data: List[dict] = []
    parent_post_id: Optional[str] = None
    external_reply_uri: Optional[str] = None
    external_reply_cid: Optional[str] = None
    error_message: Optional[str] = None
    post_uri: Optional[str] = None
    reply_gate: Optional[List[str]] = None
    disable_quotes: bool = False
    is_quote: bool = False


class SettingsUpdate(BaseModel):
    pass


class SettingsResponse(BaseModel):
    pass


class HashtagHistoryResponse(BaseModel):
    tags: List[str]
