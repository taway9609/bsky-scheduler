import os
import re
import uuid
import time
import datetime
import logging
from datetime import datetime as dt, timezone, timedelta
from rq import Queue
from redis import Redis
from redis.exceptions import ConnectionError as RedisConnectionError
from app.config import settings

logger = logging.getLogger(__name__)

jst = timezone(timedelta(hours=9))

redis_conn = Redis.from_url(settings.REDIS_URL)
scheduler_queue = Queue('scheduler_queue', connection=redis_conn)


async def schedule_post_job(post_id: str, schedule_time: dt):
    from app.tasks import post_at_scheduled_time

    schedule_time_naive = schedule_time
    if schedule_time.tzinfo is not None:
        schedule_time_naive = schedule_time.replace(tzinfo=None)

    now = dt.now(jst).replace(tzinfo=None)
    schedule_time_jst = schedule_time_naive if schedule_time_naive.tzinfo else schedule_time_naive.replace(tzinfo=jst)
    schedule_time_jst_naive = schedule_time_jst.replace(tzinfo=None)
    delay = (schedule_time_jst_naive - now).total_seconds()

    try:
        if delay > 0:
            scheduler_queue.enqueue_in(
                timedelta(seconds=delay),
                post_at_scheduled_time,
                post_id
            )
        else:
            scheduler_queue.enqueue(post_at_scheduled_time, post_id)
    except RedisConnectionError as e:
        logger.error(f"Failed to schedule post {post_id}: {e}")
        raise


async def cancel_scheduled_job(post_id: str):
    from rq.job import Job
    from rq.exceptions import NoSuchJobError

    try:
        job = Job.fetch(post_id, connection=redis_conn)
        if job:
            job.cancel()
    except NoSuchJobError:
        logger.debug(f"Job {post_id} not found for cancellation")
    except RedisConnectionError as e:
        logger.error(f"Redis connection error while cancelling job {post_id}: {e}")
        raise


async def remove_job(job_id: str):
    from rq.job import Job
    from rq.exceptions import NoSuchJobError

    try:
        job = Job.fetch(job_id, connection=redis_conn)
        if job:
            job.delete()
    except NoSuchJobError:
        logger.debug(f"Job {job_id} not found for removal")
    except RedisConnectionError as e:
        logger.error(f"Redis connection error while removing job {job_id}: {e}")
        raise


async def load_and_reschedule_posts():
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import sessionmaker
    from app.models import ScheduledPost
    
    engine = create_engine(settings.SYNC_DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    current_time = dt.now(jst).replace(tzinfo=None)
    result = session.execute(
        select(ScheduledPost).where(
            ScheduledPost.schedule_time > current_time,
            ScheduledPost.status == 'pending'
        )
    )
    pending_posts = result.scalars().all()
    
    for post in pending_posts:
        post_time = post.schedule_time
        if post_time.tzinfo is not None:
            post_time = post_time.replace(tzinfo=None)
        
        post_time_jst = post_time if post_time.tzinfo else post_time.replace(tzinfo=jst)
        post_time_jst_naive = post_time_jst.replace(tzinfo=None)
        
        if post_time_jst_naive > current_time:
            await schedule_post_job(post.id, post_time)
    
    session.close()
