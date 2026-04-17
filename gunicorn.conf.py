import multiprocessing

bind = "0.0.0.0:6969"
worker_class = "uvicorn.workers.UvicornWorker"
workers = 4
timeout = 120
keepalive = 5

accesslog = "-"
errorlog = "-"
loglevel = "info"

max_requests = 1000
max_requests_jitter = 50
