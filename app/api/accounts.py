from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import BlueskyAccount, ScheduledPost
from app.schemas import AccountResponse
from sqlalchemy import select

router = APIRouter()


@router.get("/", response_model=dict)
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BlueskyAccount))
    accounts = result.scalars().all()
    
    return {
        'status': 'success',
        'data': [
            {
                'did': acc.did,
                'username': acc.username,
                'display_name': acc.display_name
            }
            for acc in accounts
        ]
    }
