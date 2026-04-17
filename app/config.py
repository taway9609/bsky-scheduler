from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os
import logging

TEST_ENCRYPTION_KEY = '9tM_MbOrnpqGeSDulaU7NwoUeKtPPMGNt1LHxJ4LaZ4='


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')
    
    SECRET_KEY: str = "change-this-to-a-random-secret-key"
    
    ENCRYPTION_KEY: str = ""
    
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "bluesky_scheduler"
    DB_USER: str = "bluesky"
    DB_PASSWORD: str = "changeme"
    
    REDIS_URL: str = "redis://localhost:6379/0"
    
    UPLOAD_FOLDER: str = "uploads"
    IMAGE_FOLDER: str = "app/static/images"
    
    SCHEDULER_RETENTION_DAYS: int = 90
    
    USE_MOCK_BLUESKY: bool = False
    
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    def get_encryption_key(self) -> str:
        if not self.ENCRYPTION_KEY:
            return TEST_ENCRYPTION_KEY
        return self.ENCRYPTION_KEY

    def configure_logging(self) -> None:
        """Configure logging for the application"""
        logging.basicConfig(
            level=getattr(logging, self.LOG_LEVEL),
            format=self.LOG_FORMAT,
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler('/app/logs/app.log', encoding='utf-8')
            ]
        )
        # Set specific logger level for app.utils
        logging.getLogger('app.utils').setLevel(getattr(logging, self.LOG_LEVEL))


settings = Settings()
