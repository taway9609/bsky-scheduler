import redis.asyncio as redis
from typing import Optional
from app.config import settings
import json

redis_client = None


async def get_redis():
    global redis_client
    if redis_client is None:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_client


async def get_cached_session(did: str) -> Optional[dict]:
    client = await get_redis()
    cached = await client.get(f"bluesky_session:{did}")
    if cached:
        return json.loads(cached)
    return None


async def cache_session(did: str, session_data: dict, ttl: int = 3600):
    client = await get_redis()
    await client.setex(f"bluesky_session:{did}", ttl, json.dumps(session_data))


async def delete_cached_session(did: str):
    client = await get_redis()
    await client.delete(f"bluesky_session:{did}")
