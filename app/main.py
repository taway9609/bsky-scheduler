import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.config import settings
from app.templates import templates

# Configure logging
settings.configure_logging()
logger = logging.getLogger(__name__)

_coverage_instance = None

try:
    import coverage
    _coverage_instance = coverage.Coverage(source=['app'], data_file=None)
    _coverage_instance.start()
except ImportError:
    pass


class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        path = request.url.path
        if path.startswith('/static/') or path.startswith('/favicon'):
            return response
        
        content_type = response.headers.get('content-type', '')
        if 'text/html' in content_type or response.status_code in (302, 301):
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        
        return response


class CoverageMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if _coverage_instance is not None:
            _coverage_instance.switch_context(str(request.url.path))
        response = await call_next(request)
        from app.api.coverage import record_request
        record_request(request.method, request.url.path)
        return response


def get_coverage_data():
    if _coverage_instance is None:
        return None
    _coverage_instance.stop()
    _coverage_instance.save()
    return _coverage_instance


def reset_coverage():
    global _coverage_instance
    if _coverage_instance is not None:
        _coverage_instance.stop()
        _coverage_instance.erase()
        _coverage_instance.start()


from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application lifespan...")
    
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(settings.IMAGE_FOLDER, exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    logger.debug(f"Created directories: uploads={settings.UPLOAD_FOLDER}, images={settings.IMAGE_FOLDER}, logs=logs")

    logger.debug("Initializing database...")
    await init_db()
    logger.info("Database initialized successfully")

    yield

    logger.debug("Cleaning up database engine...")
    from app.database import _get_engine
    engine = _get_engine()
    if engine is not None:
        await engine.dispose()
        logger.info("Database engine disposed")


app = FastAPI(
    title="Bluesky Scheduler",
    description="Bluesky 予約投稿アプリケーション",
    version="2.0.0",
    lifespan=lifespan,
)

# Get allowed origins from environment or use development defaults
import os
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(NoCacheMiddleware)

if _coverage_instance is not None:
    app.add_middleware(CoverageMiddleware)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


templates = Jinja2Templates(directory="app/templates")


def static_url(filename: str) -> str:
    return f"/static/{filename}"

def get_flashed_messages(with_categories=False):
    return []

def url_for(name: str, **params) -> str:
    route_map = {
        'bluesky.schedule_post': '/bluesky/posts',
        'bluesky.logout': '/bluesky/logout',
        'static': '/static',
    }
    if name in route_map:
        path = route_map[name]
        if name == 'static' and 'filename' in params:
            path += '/' + params['filename']
        elif params:
            path += '?' + '&'.join(f"{k}={v}" for k, v in params.items())
        return path
    raise ValueError(f"Unknown route: {name}")

templates.env.globals["static_url"] = static_url
templates.env.globals["get_flashed_messages"] = get_flashed_messages
templates.env.globals["url_for"] = url_for

from app.api import bluesky, accounts, posts, auth, admin, coverage

app.include_router(bluesky.router, prefix="/bluesky", tags=["bluesky"])
app.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
app.include_router(posts.router, prefix="/posts", tags=["posts"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(admin.router, tags=["admin"])
app.include_router(coverage.router, tags=["coverage"])


@app.get("/")
async def root():
    logger.debug("Root endpoint accessed")
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/bluesky/scheduler")


@app.get("/health")
async def health_check():
    logger.debug("Health check endpoint accessed")
    return {"status": "healthy"}
