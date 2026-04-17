import logging
from fastapi import APIRouter, Depends, HTTPException, status, Form, Request, Cookie, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import User, AppSettings
from app.services.auth import (
    hash_password, verify_password, create_access_token,
    validate_password_strength, validate_username
)
from app.api.deps import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str
    remember_me: bool = False


def get_cookie_or_token(request: Request) -> Optional[str]:
    return request.cookies.get('access_token')


async def is_registration_enabled(db: AsyncSession) -> bool:
    result = await db.execute(select(AppSettings).where(AppSettings.key == "REGISTRATION_ENABLED"))
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        return setting.value.lower() == "true"
    return True


@router.post("/register", response_model=dict)
async def register(
    username: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    logger.debug(f"Registration attempt for username: {username}")
    
    if not await is_registration_enabled(db):
        logger.warning("Registration disabled - registration attempt rejected")
        return {"status": "error", "message": "現在、新しいアカウントの作成は停止しています"}
    
    valid, error = validate_username(username)
    if not valid:
        logger.warning(f"Invalid username format: {username} - {error}")
        return {"status": "error", "message": error}
    
    valid, error = validate_password_strength(password)
    if not valid:
        logger.warning(f"Invalid password strength: {error}")
        return {"status": "error", "message": error}
    
    result = await db.execute(select(User).where(User.username == username))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        logger.warning(f"Username already exists: {username}")
        return {"status": "error", "message": "このユーザー名は既に存在します"}
    
    password_hash = hash_password(password)
    
    new_user = User(
        username=username,
        password_hash=password_hash
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    access_token, expires_in = create_access_token(new_user.id, remember_me=False)
    logger.info(f"New user registered successfully: {username} (ID: {new_user.id})")
    
    max_age = 86400
    is_localhost = False
    cookie_secure = False if is_localhost else True
    cookie_samesite = "lax" if is_localhost else "strict"
    
    response = JSONResponse(content={
        "status": "success",
        "message": "登録が完了しました",
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": {
            "id": new_user.id,
            "username": new_user.username
        }
    })
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="user_id",
        value=str(new_user.id),
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="is_admin",
        value="0",
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="username",
        value=new_user.username,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    
    return response


@router.post("/login", response_model=dict)
async def login_json(
    request: Request,
    identifier: str = Form(...),
    password: str = Form(...),
    remember_me: bool = Form(False),
    return_url: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    logger.debug(f"Login attempt for identifier: {identifier}")
    
    result = await db.execute(select(User).where(User.username == identifier))
    user = result.scalar_one_or_none()
    
    if not user:
        logger.warning(f"Login failed - user not found: {identifier}")
        return {"status": "error", "message": "ユーザー名またはパスワードが正しくありません"}
    
    if not verify_password(password, user.password_hash):
        logger.warning(f"Login failed - invalid password for user: {identifier}")
        return {"status": "error", "message": "ユーザー名またはパスワードが正しくありません"}
    
    if not user.is_active:
        logger.warning(f"Login failed - inactive user: {identifier}")
        return {"status": "error", "message": "アカウントが無効になっています"}
    
    access_token, expires_in = create_access_token(user.id, remember_me=remember_me)
    logger.info(f"User logged in successfully: {identifier} (ID: {user.id})")
    
    max_age = expires_in
    if not remember_me:
        max_age = 86400
    
    is_localhost = request.url.hostname in ['localhost', '127.0.0.1', '0.0.0.0'] if request.url.hostname else True
    cookie_secure = False if is_localhost else True
    cookie_samesite = "lax" if is_localhost else "strict"
    
    response = JSONResponse(content={
        "status": "success",
        "message": "ログインしました",
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": {
            "id": user.id,
            "username": user.username,
            "is_admin": user.is_admin
        }
    })
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="user_id",
        value=str(user.id),
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="is_admin",
        value="1" if user.is_admin else "0",
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="username",
        value=user.username,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    
    if return_url:
        response.content["return_url"] = return_url
    
    return response


@router.post("/login/redirect")
async def login_redirect(
    request: Request,
    identifier: str = Form(...),
    password: str = Form(...),
    remember_me: bool = Form(False),
    return_url: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.username == identifier))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(password, user.password_hash) or not user.is_active:
        return {"status": "error", "message": "ユーザー名またはパスワードが正しくありません"}
    
    access_token, expires_in = create_access_token(user.id, remember_me=remember_me)
    
    max_age = expires_in
    if not remember_me:
        max_age = 86400
    
    redirect_url = return_url if return_url else "/bluesky/scheduler"
    
    response = JSONResponse(content={
        "status": "success",
        "message": "ログインしました",
        "redirect_url": redirect_url,
    })
    
    # Set secure=False for localhost, secure=True for production
    is_localhost = request.url.hostname in ['localhost', '127.0.0.1', '0.0.0.0']
    
    # For localhost, we need to set secure=False to allow cookies to work
    cookie_secure = False if is_localhost else True
    
    # Set SameSite attribute based on environment
    # Development (localhost): SameSite=Lax (allows cookies on top-level navigation)
    # Production (HTTPS): SameSite=Strict (most secure, cookies only sent to same site)
    cookie_samesite = "lax" if is_localhost else "strict"
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="user_id",
        value=str(user.id),
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="is_admin",
        value="1" if user.is_admin else "0",
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    response.set_cookie(
        key="username",
        value=user.username,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure
    )
    
    return response


@router.post("/logout", response_model=dict)
async def logout(
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    is_localhost = request.url.hostname in ['localhost', '127.0.0.1', '0.0.0.0']
    cookie_samesite = "lax" if is_localhost else "strict"
    cookie_secure = False if is_localhost else True
    
    response = JSONResponse(content={
        "status": "success",
        "message": "ログアウトしました"
    })
    
    for key in ["access_token", "user_id", "is_admin", "username"]:
        response.delete_cookie(
            key=key,
            path="/",
            samesite=cookie_samesite,
            secure=cookie_secure,
        )
    
    if current_user:
        logger.info(f"User logged out: {current_user.username} (ID: {current_user.id})")
    return response


@router.get("/me", response_model=dict)
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "status": "success",
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "is_admin": current_user.is_admin,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        }
    }


@router.get("/register", response_class=HTMLResponse)
async def register_page(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    from app.main import templates
    if current_user and current_user.is_active:
        return RedirectResponse(url="/bluesky/scheduler", status_code=302)
    registration_enabled = await is_registration_enabled(db)
    return templates.TemplateResponse("auth/register.html", {
        "request": request,
        "error": None,
        "username": None,
        "registration_enabled": registration_enabled
    })


@router.get("/login", response_class=HTMLResponse)
async def login_page(
    request: Request,
    return_url: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    from app.main import templates
    if current_user and current_user.is_active:
        target = "/bluesky/scheduler"
        return RedirectResponse(url=target, status_code=302)
    registration_enabled = await is_registration_enabled(db)
    return templates.TemplateResponse("auth/login.html", {
        "request": request,
        "error": None,
        "return_url": return_url,
        "registration_enabled": registration_enabled
    })


@router.post("/change-password", response_model=dict)
async def change_password(
    password_data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logger.debug(f"Password change request for user: {current_user.username}")
    
    if not verify_password(password_data.current_password, current_user.password_hash):
        logger.warning(f"Password change failed - invalid current password for user: {current_user.username}")
        return {"status": "error", "message": "現在のパスワードが正しくありません"}
    
    valid, error = validate_password_strength(password_data.new_password)
    if not valid:
        logger.warning(f"Password change failed - weak password for user: {current_user.username}")
        return {"status": "error", "message": error}
    
    current_user.password_hash = hash_password(password_data.new_password)
    await db.commit()
    logger.info(f"Password changed successfully for user: {current_user.username}")
    
    return {"status": "success", "message": "パスワードを変更しました"}
