#!/bin/bash
set -e

gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:6969 &
WEB_PID=$!

rq worker --with-scheduler scheduler_queue &
WORKER_PID=$!

trap "kill $WEB_PID $WORKER_PID 2>/dev/null" EXIT

wait
