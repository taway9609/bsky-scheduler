from datetime import datetime, timedelta
from typing import Optional, Tuple
from jose import JWTError, jwt
import hashlib
import secrets
from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 86400  # 24 hours
ACCESS_TOKEN_EXPIRE_SECONDS_REMEMBER = 7776000  # 90 days

SALT_LENGTH = 32


def hash_password(password: str) -> str:
    salt = secrets.token_hex(SALT_LENGTH)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${pwd_hash.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        parts = hashed_password.split('$')
        if len(parts) != 2:
            return False
        salt, stored_hash = parts
        pwd_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return pwd_hash.hex() == stored_hash
    except Exception:
        return False


def create_access_token(user_id: int, remember_me: bool = False) -> Tuple[str, int]:
    expire = datetime.utcnow() + timedelta(
        seconds=ACCESS_TOKEN_EXPIRE_SECONDS_REMEMBER if remember_me else ACCESS_TOKEN_EXPIRE_SECONDS
    )
    expires_in = ACCESS_TOKEN_EXPIRE_SECONDS_REMEMBER if remember_me else ACCESS_TOKEN_EXPIRE_SECONDS
    
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expires_in


def decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id is None or token_type != "access":
            return None
        
        return int(user_id)
    except JWTError:
        return None


def validate_password_strength(password: str) -> Tuple[bool, str]:
    if len(password) < 6:
        return False, "パスワードは6文字以上必要です"
    
    if len(password) > 128:
        return False, "パスワードは128文字以内にしてください"
    
    return True, ""


def validate_username(username: str) -> Tuple[bool, str]:
    if len(username) < 3:
        return False, "ユーザー名は3文字以上必要です"
    
    if len(username) > 32:
        return False, "ユーザー名は32文字以内にしてください"
    
    if not username.isalnum() and not username.replace("_", "").isalnum():
        return False, "ユーザー名には英数字とアンダースコアのみ使用できます"
    
    return True, ""
