import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or '6dtr67ht87t4fh5t7847tfht6t4675djt64'
    UPLOAD_FOLDER = 'uploads/'
    STATIC_FOLDER = 'app/static/'
    IMAGE_FOLDER = 'app/static/images/'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///scheduler.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SCHEDULER_RETENTION_DAYS = 90
