from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings
import logging
import threading

logger = logging.getLogger(__name__)

# Thread-local storage for database engine and session maker
_local = threading.local()

Base = declarative_base()


def _get_engine():
    """Get or create engine for the current thread."""
    if not hasattr(_local, 'engine'):
        _local.engine, _local.async_session_maker = _create_engine()
    return _local.engine


def _get_async_session_maker():
    """Get or create async session maker for the current thread."""
    if not hasattr(_local, 'async_session_maker'):
        _local.engine, _local.async_session_maker = _create_engine()
    return _local.async_session_maker


def _create_engine():
    logger.debug(f"Creating database engine for: {settings.DATABASE_URL}")
    try:
        # SQLite doesn't support pool_size and max_overflow
        if "sqlite" in settings.DATABASE_URL:
            logger.debug("Using SQLite database configuration")
            engine = create_async_engine(
                settings.DATABASE_URL,
                echo=False,
                connect_args={"check_same_thread": False},
            )
            async_session_maker = async_sessionmaker(
                engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autocommit=False,
            )
        else:
            logger.debug("Using PostgreSQL database configuration")
            engine = create_async_engine(
                settings.DATABASE_URL,
                echo=False,
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
            )
            async_session_maker = async_sessionmaker(
                engine,
                class_=AsyncSession,
                expire_on_commit=False,
            )
        logger.debug("Database engine created successfully")
        return engine, async_session_maker
    except Exception as e:
        logger.warning(f"Could not create async engine: {e}")
        return None, None


async def get_db():
    async_session_maker = _get_async_session_maker()
    if async_session_maker is None:
        raise RuntimeError("Database not available")
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    engine = _get_engine()
    if engine is None:
        logger.warning("Database engine not available, skipping initialization")
        return
    try:
        from app.models import Base as ModelsBase
        from app.models import BlueskyAccount, AppSettings, ScheduledPost, HashtagUsage, User
        async with engine.begin() as conn:
            await conn.run_sync(ModelsBase.metadata.create_all)
            logger.info("Database tables created/verified successfully")
        
        await _create_default_admin()
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            logger.info("Tables already exist, skipping creation")
        else:
            logger.warning(f"Database initialization error: {e}")


async def _create_default_admin():
    from sqlalchemy import select
    from app.services.auth import hash_password
    from app.models import User

    async_session_maker = _get_async_session_maker()
    if async_session_maker is None:
        logger.warning("async_session_maker not available, skipping admin creation")
        return

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()

        if not admin:
            admin = User(
                username="admin",
                password_hash=hash_password("admin123"),
                is_admin=True
            )
            session.add(admin)
            await session.commit()
            logger.info("Default admin user created (admin/admin123) with admin privileges")
        else:
            if not admin.is_admin:
                admin.is_admin = True
                await session.commit()
                logger.info("Admin user updated with admin privileges")
            else:
                logger.info("Admin user already has admin privileges")
