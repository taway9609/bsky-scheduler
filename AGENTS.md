# AGENTS.md - Development Guide for Agentic Coding Agents

FastAPI-based Bluesky Scheduler application for scheduling Bluesky posts.

## Development Philosophy

- 原則としてテスト駆動開発（TDD）で進める
- 期待される入出力に基づき、まずテストを作成する

## Build/Lint/Test Commands

### Running the Application

```bash
# Local development (SQLite, auto-reload)
python run.py

# Docker (PostgreSQL + Redis)
docker build -t app-dev . && docker run -p 8000:8000 app-dev

# Production (Gunicorn + RQ worker)
./start.sh
```

### Running Tests

```bash
# All unit tests
python -m pytest tests/ -v

# Single test file
python -m pytest tests/test_mock_bluesky.py -v

# Single test function
python -m pytest tests/test_mock_bluesky.py::TestMockBlueskyProfile::test_get_profile_returns_mock_profile -v

# With coverage
python -m pytest tests/ --cov=app --cov-report=html
```

### Linting

```bash
# Syntax check
python -m py_compile app/*.py app/**/*.py

# flake8
flake8 app/ --max-line-length=120
```

### After Making Changes

実装後は必ず lint と syntax check を実行してコードの正確性を確認すること。

```bash
# Syntax check + flake8
python -m py_compile app/*.py app/**/*.py && flake8 app/ --max-line-length=120
```

### Build & Test with Chrome DevTools

コード変更後は、app-dev サービスをビルドし、chrome-devtools で動作確認すること。

```bash
# Build app-dev service
docker build -t app-dev .

# Run app-dev service
docker run -d -p 8000:8000 --name app-dev-test app-dev

# Open http://localhost:8000 in Chrome DevTools and verify functionality
# Use chrome-devtools tools to interact with the running application
```

chrome-devtools を使用した確認手順:
1. `chrome-devtools_navigate_page` で `http://localhost:8000` にアクセス
2. `chrome-devtools_take_snapshot` でページ構造を確認
3. `chrome-devtools_take_screenshot` で表示を確認
4. 必要に応じて `chrome-devtools_evaluate_script` で JavaScript を実行
5. 確認終了後、コンテナを停止: `docker stop app-dev-test && docker rm app-dev-test`

## Code Style

### Imports (ordered)
1. Standard library
2. Third-party
3. Local (`from app.`)

Alphabetical within groups, blank line between groups.

```python
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
```

### Formatting
- Max 120 chars/line
- 4 spaces (no tabs)
- Two blank lines between top-level defs/classes
- No trailing whitespace

### Naming
- Variables/functions: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- DB Models: singular (e.g., `User`, not `Users`)

### Types
- All function params/returns: type hints
- DB: `AsyncSession`
- Request/response: Pydantic models
- Nullable: `Optional[Type]`

### Error Handling
```python
from fastapi import HTTPException, status

try:
    await db.commit()
except IntegrityError:
    await db.rollback()
    raise HTTPException(status_code=400, detail="Username exists")
```

## Project Structure

```
app/
├── api/           # Route handlers (accounts.py, auth.py, posts.py, etc.)
├── services/      # Business logic
├── models.py     # SQLAlchemy models
├── schemas.py    # Pydantic schemas
├── database.py   # DB config
├── config.py     # Settings
├── utils.py      # Helpers
├── tasks.py      # RQ task handlers
├── scheduler.py  # Scheduling logic
├── main.py       # FastAPI app
├── templates/    # Jinja2 templates
└── static/       # CSS, JS, images

tests/
├── test_mock_bluesky.py
└── utils/
    └── mock_bluesky.py  # Mock for Bluesky API

requirements.txt
docker-compose.yml
run.py
worker.py
```

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key |
| `ENCRYPTION_KEY` | Password encryption |
| `DB_HOST/PORT/NAME/USER/PASSWORD` | PostgreSQL connection |
| `REDIS_URL` | Redis connection |
| `USE_MOCK_BLUESKY` | Use mock Bluesky (default: false) |

## Test Credentials

| Username | Password |
|----------|----------|
| `admin` | `admin123` |

Login URL: `http://localhost:6969/auth/login`
