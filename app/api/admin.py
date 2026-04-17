from fastapi import APIRouter, Depends, HTTPException, Request, Cookie, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.database import get_db
from app.models import User, BlueskyAccount, ScheduledPost, HashtagUsage, ErrorLog, AppSettings
from app.api.deps import get_admin_user
from app.services.auth import hash_password, decode_token
from app.templates import templates

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/", response_class=HTMLResponse)
async def admin_dashboard(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get('access_token')
    
    if token:
        user_id = decode_token(token)
        
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.is_active and user.is_admin:
                return templates.TemplateResponse("admin/index.html", {
                    "request": request,
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "access_token": token
                })
    
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.replace('Bearer ', '')
        user_id = decode_token(token)
        
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.is_active and user.is_admin:
                return templates.TemplateResponse("admin/index.html", {
                    "request": request,
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "access_token": token
                })
    
    return RedirectResponse(url="/auth/login?return_url=/admin")


@router.get("/settings", response_class=HTMLResponse)
async def admin_settings_page(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get('access_token')
    
    if token:
        user_id = decode_token(token)
        
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.is_active and user.is_admin:
                return templates.TemplateResponse("admin/settings.html", {
                    "request": request,
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "access_token": token
                })
    
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.replace('Bearer ', '')
        user_id = decode_token(token)
        
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.is_active and user.is_admin:
                return templates.TemplateResponse("admin/settings.html", {
                    "request": request,
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "access_token": token
                })
    
    return RedirectResponse(url="/auth/login?return_url=/admin/settings")


@router.get("/users", response_class=HTMLResponse)
async def admin_users_page(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get('access_token')
    
    if token:
        user_id = decode_token(token)
        
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.is_active and user.is_admin:
                return templates.TemplateResponse("admin/users.html", {
                    "request": request,
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "access_token": token
                })
    
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.replace('Bearer ', '')
        user_id = decode_token(token)
        
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.is_active and user.is_admin:
                return templates.TemplateResponse("admin/users.html", {
                    "request": request,
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "access_token": token
                })
    
    return RedirectResponse(url="/auth/login?return_url=/admin/users")


@router.get("/error-logs/list")
async def get_error_logs(
    page: int = 1,
    per_page: int = 20,
    resolved: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    offset = (page - 1) * per_page
    
    query = select(ErrorLog).order_by(ErrorLog.created_at.desc()).offset(offset).limit(per_page)
    count_query = select(func.count(ErrorLog.id))
    
    if resolved is not None:
        query = query.where(ErrorLog.resolved == resolved)
        count_query = count_query.where(ErrorLog.resolved == resolved)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    logs_data = []
    for log in logs:
        logs_data.append({
            "id": log.id,
            "error_type": log.error_type,
            "message": log.message,
            "details": log.details,
            "user_id": log.user_id,
            "post_id": log.post_id,
            "account_did": log.account_did,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "resolved": log.resolved
        })
    
    return {
        "status": "success",
        "data": {
            "logs": logs_data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page if total > 0 else 0
        }
    }


@router.get("/error-logs", response_class=HTMLResponse)
async def admin_error_logs_page(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get('access_token')
    
    if token:
        user_id = decode_token(token)
        
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.is_active and user.is_admin:
                return templates.TemplateResponse("admin/error-logs.html", {
                    "request": request,
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "access_token": token
                })
    
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.replace('Bearer ', '')
        user_id = decode_token(token)
        
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.is_active and user.is_admin:
                return templates.TemplateResponse("admin/error-logs.html", {
                    "request": request,
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "access_token": token
                })
    
    return RedirectResponse(url="/auth/login?return_url=/admin/error-logs")


@router.get("/users/list")
async def list_users(
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    offset = (page - 1) * per_page
    
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    users = result.scalars().all()
    
    total_result = await db.execute(select(func.count(User.id)))
    total = total_result.scalar() or 0
    
    users_data = []
    for user in users:
        accounts_result = await db.execute(
            select(func.count(BlueskyAccount.did))
            .where(BlueskyAccount.user_id == user.id)
        )
        accounts_count = accounts_result.scalar() or 0
        
        posts_result = await db.execute(
            select(func.count(ScheduledPost.id))
            .where(ScheduledPost.user_id == user.id)
        )
        posts_count = posts_result.scalar() or 0
        
        users_data.append({
            "id": user.id,
            "username": user.username,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "bluesky_accounts_count": accounts_count,
            "posts_count": posts_count
        })
    
    return {
        "status": "success",
        "data": {
            "users": users_data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page if total > 0 else 0
        }
    }


@router.patch("/error-logs/{log_id}/resolve")
async def resolve_error_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(ErrorLog).where(ErrorLog.id == log_id))
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="エラーログが見つかりません")
    
    log.resolved = True
    await db.commit()
    
    return {"status": "success", "message": "エラーを解決済みにしました"}


@router.patch("/error-logs/{log_id}/unresolve")
async def unresolve_error_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(ErrorLog).where(ErrorLog.id == log_id))
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="エラーログが見つかりません")
    
    log.resolved = False
    await db.commit()
    
    return {"status": "success", "message": "エラーを未解決に戻しました"}


@router.delete("/error-logs/{log_id}")
async def delete_error_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(ErrorLog).where(ErrorLog.id == log_id))
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="エラーログが見つかりません")
    
    await db.delete(log)
    await db.commit()
    
    return {"status": "success", "message": "エラーログを削除しました"}


@router.post("/error-logs/delete-resolved")
async def delete_resolved_logs(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(ErrorLog).where(ErrorLog.resolved == True))
    logs = result.scalars().all()
    
    count = 0
    for log in logs:
        await db.delete(log)
        count += 1
    
    await db.commit()
    
    return {"status": "success", "message": f"{count}件の解決済みエラーログを削除しました", "deleted_count": count}


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    accounts_result = await db.execute(
        select(BlueskyAccount)
        .where(BlueskyAccount.user_id == user.id)
    )
    accounts = accounts_result.scalars().all()
    
    posts_result = await db.execute(
        select(ScheduledPost)
        .where(ScheduledPost.user_id == user.id)
        .order_by(ScheduledPost.schedule_time.desc())
        .limit(10)
    )
    posts = posts_result.scalars().all()
    
    return {
        "status": "success",
        "data": {
            "id": user.id,
            "username": user.username,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "bluesky_accounts": [
                {
                    "did": acc.did,
                    "username": acc.username,
                    "display_name": acc.display_name
                }
                for acc in accounts
            ],
            "recent_posts": [
                {
                    "id": post.id,
                    "content": post.content[:100] + "..." if len(post.content) > 100 else post.content,
                    "status": post.status,
                    "schedule_time": post.schedule_time.strftime('%Y-%m-%dT%H:%M+09:00') if post.schedule_time else None
                }
                for post in posts
            ]
        }
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="自分自身を削除することはできません")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    accounts_result = await db.execute(
        select(BlueskyAccount).where(BlueskyAccount.user_id == user_id)
    )
    accounts = accounts_result.scalars().all()
    
    for account in accounts:
        posts_result = await db.execute(
            select(ScheduledPost).where(ScheduledPost.account_did == account.did)
        )
        posts = posts_result.scalars().all()
        for post in posts:
            await db.delete(post)
        
        hashtag_result = await db.execute(
            select(HashtagUsage).where(HashtagUsage.account_username == account.username)
        )
        hashtags = hashtag_result.scalars().all()
        for tag in hashtags:
            await db.delete(tag)
        
        await db.delete(account)
    
    posts_result = await db.execute(
        select(ScheduledPost).where(ScheduledPost.user_id == user_id)
    )
    posts = posts_result.scalars().all()
    for post in posts:
        await db.delete(post)
    
    hashtag_result = await db.execute(
        select(HashtagUsage).where(HashtagUsage.user_id == user_id)
    )
    hashtags = hashtag_result.scalars().all()
    for tag in hashtags:
        await db.delete(tag)
    
    await db.delete(user)
    await db.commit()
    
    return {"status": "success", "message": "ユーザーを削除しました"}


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="自分のアカウントの状態を変更することはできません")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    user.is_active = not user.is_active
    await db.commit()
    
    return {
        "status": "success",
        "message": f"ユーザーを{'有効' if user.is_active else '無効'}にしました",
        "is_active": user.is_active
    }


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="自分自身のパスワードはリセットできません")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    import secrets
    temp_password = secrets.token_urlsafe(8)
    user.password_hash = hash_password(temp_password)
    await db.commit()
    
    return {
        "status": "success",
        "message": "パスワードをリセットしました",
        "temporary_password": temp_password
    }


@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    users_count_result = await db.execute(select(func.count(User.id)))
    users_count = users_count_result.scalar() or 0
    
    active_users_result = await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )
    active_users = active_users_result.scalar() or 0
    
    accounts_count_result = await db.execute(select(func.count(BlueskyAccount.did)))
    accounts_count = accounts_count_result.scalar() or 0
    
    posts_count_result = await db.execute(select(func.count(ScheduledPost.id)))
    posts_count = posts_count_result.scalar() or 0
    
    pending_posts_result = await db.execute(
        select(func.count(ScheduledPost.id)).where(ScheduledPost.status == "pending")
    )
    pending_posts = pending_posts_result.scalar() or 0
    
    posted_posts_result = await db.execute(
        select(func.count(ScheduledPost.id)).where(ScheduledPost.status == "posted")
    )
    posted_posts = posted_posts_result.scalar() or 0
    
    failed_posts_result = await db.execute(
        select(func.count(ScheduledPost.id)).where(ScheduledPost.status == "failed")
    )
    failed_posts = failed_posts_result.scalar() or 0
    
    error_logs_count_result = await db.execute(select(func.count(ErrorLog.id)))
    error_logs_count = error_logs_count_result.scalar() or 0
    
    unresolved_errors_result = await db.execute(
        select(func.count(ErrorLog.id)).where(ErrorLog.resolved == False)
    )
    unresolved_errors = unresolved_errors_result.scalar() or 0
    
    return {
        "status": "success",
        "data": {
            "users": {
                "total": users_count,
                "active": active_users
            },
            "bluesky_accounts": {
                "total": accounts_count
            },
            "posts": {
                "total": posts_count,
                "pending": pending_posts,
                "posted": posted_posts,
                "failed": failed_posts
            },
            "error_logs": {
                "total": error_logs_count,
                "unresolved": unresolved_errors
            }
        }
    }


REGISTRATION_ENABLED_KEY = "REGISTRATION_ENABLED"

@router.get("/api/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(AppSettings).where(AppSettings.key == REGISTRATION_ENABLED_KEY))
    setting = result.scalar_one_or_none()
    
    registration_enabled = True
    if setting and setting.value:
        registration_enabled = setting.value.lower() == "true"
    
    return {
        "status": "success",
        "data": {
            "registration_enabled": registration_enabled
        }
    }


@router.put("/api/settings")
async def update_settings(
    registration_enabled: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    if registration_enabled is not None:
        enabled_value = str(registration_enabled).lower() in ("true", "1", "on")
        result = await db.execute(select(AppSettings).where(AppSettings.key == REGISTRATION_ENABLED_KEY))
        setting = result.scalar_one_or_none()
        
        if setting:
            setting.value = "true" if enabled_value else "false"
        else:
            setting = AppSettings(
                key=REGISTRATION_ENABLED_KEY,
                value="true" if enabled_value else "false",
                user_id=admin.id,
            )
            db.add(setting)
        
        await db.commit()
    
    return {"status": "success", "message": "設定を更新しました"}
