from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import ScheduledPost
from sqlalchemy import select

router = APIRouter()


@router.get("/", response_model=dict)
async def list_posts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledPost))
    posts = result.scalars().all()
    
    return {
        'status': 'success',
        'data': [
            {
                'id': post.id,
                'account': post.account_username,
                'content': post.content,
                'status': post.status,
                'schedule_time': post.schedule_time.strftime('%Y-%m-%dT%H:%M+09:00') if post.schedule_time else None
            }
            for post in posts
        ]
    }
