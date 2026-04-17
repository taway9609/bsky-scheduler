#!/usr/bin/env python3
"""Run the RQ worker for scheduled posts."""

import redis
from rq import Worker, Queue, Connection

if __name__ == "__main__":
    redis_url = "redis://localhost:6379/0"
    conn = redis.from_url(redis_url)
    
    with Connection(conn):
        worker = Worker(["scheduler_queue"])
        worker.work()
