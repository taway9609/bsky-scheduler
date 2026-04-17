# Bluesky Scheduler

FastAPIベースのBluesky投稿スケジュール管理アプリケーション。
Kilo Code, Opencode, Claude CodeのエージェントAIにより作られたプログラムです。
テストなどは実施していますが予期せぬバグが起こる場合があります。ご了承ください。

## 概要

Blueskyへの投稿を予約・管理するためのWebアプリケーションです。PostgreSQL、Redis、RQを使用したバックグラウンドジョブ処理により、信頼性の高いスケジュール投稿を実現します。

## 主な機能

- ユーザー認証（JWT）
- Blueskyアカウント連携
- 投稿のスケジュール予約
- 画像付き投稿のサポート
- ダッシュボードによる投稿管理
- モックBluesky API（開発・テスト用）

## テクノロジー

- **Backend:** FastAPI, Python 3.11
- **Database:** PostgreSQL / SQLite（開発用）
- **Queue:** Redis + RQ
- **Frontend:** Jinja2, jQuery
- **Auth:** python-jose, passlib

## 開発環境のセットアップ

### 必要条件

- Docker & Docker Compose
- Python 3.11+（ローカル実行時）

### Docker Composeで起動

```bash
# 開発環境の起動
docker compose up app-dev

# アプリケーションにアクセス
# http://localhost:8000
```

### ローカルで実行

```bash
# 依存関係のインストール
pip install -r requirements.txt

# 開発サーバーの起動
python run.py
```

### テスト用認証情報

| ユーザー名 | パスワード |
|-----------|-----------|
| `admin`   | `admin123` |

ログインURL: `http://localhost:6969/auth/login`

## 開発哲学

- 原則としてテスト駆動開発（TDD）で進める
- 期待される入出力に基づき、まずテストを作成する
- 実装コードは書かず、テストのみを用意する
- テストを実行し、失敗を確認する
- テストが正しいことを確認できた段階でコミットする
- その後、テストをパスさせる実装を進める
- 実装中はテストを変更せず、コードを修正し続ける
- すべてのテストが通過するまで繰り返す

## テスト

```bash
# 全テストを実行
python -m pytest tests/ -v

# カバレッジ付きで実行
python -m pytest tests/ --cov=app --cov-report=html

# 特定のテストファイルを実行
python -m pytest tests/test_mock_bluesky.py -v

# 特定のテスト関数を実行
python -m pytest tests/test_mock_bluesky.py::TestMockBlueskyProfile::test_get_profile_returns_mock_profile -v
```

## Lint & フォーマット

```bash
# 構文チェック
python -m py_compile app/*.py app/**/*.py

# flake8
flake8 app/ --max-line-length=120

# 実装後は必ず lint と syntax check を実行
python -m py_compile app/*.py app/**/*.py && flake8 app/ --max-line-length=120
```

## Build & Test with Chrome DevTools

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

## コードスタイル

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

## プロジェクト構造

```
app/
├── api/           # ルートハンドラ (accounts.py, auth.py, posts.py, etc.)
├── services/      # ビジネスロジック
├── models.py      # SQLAlchemyモデル
├── schemas.py     # Pydanticスキーマ
├── database.py    # データベース設定
├── config.py      # アプリケーション設定
├── utils.py       # ヘルパー関数
├── tasks.py       # RQタスクハンドラ
├── scheduler.py   # スケジューリングロジック
├── main.py        # FastAPIアプリケーション
├── templates/     # Jinja2テンプレート
└── static/        # CSS, JS, 画像

tests/
├── test_mock_bluesky.py
└── utils/
    └── mock_bluesky.py  # Bluesky APIのモック

requirements.txt
docker-compose.yml
run.py
worker.py
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `SECRET_KEY` | JWT署名キー |
| `ENCRYPTION_KEY` | パスワード暗号化キー |
| `DB_HOST` | PostgreSQLホスト |
| `DB_PORT` | PostgreSQLポート |
| `DB_NAME` | データベース名 |
| `DB_USER` | データベースユーザー名 |
| `DB_PASSWORD` | データベースパスワード |
| `REDIS_URL` | Redis接続URL |
| `USE_MOCK_BLUESKY` | モックBluesky API使用（デフォルト: false） |

`.env.example`をコピーして`.env`を作成し、必要な値を設定してください。

## テスト用認証情報

| ユーザー名 | パスワード |
|-----------|-----------|
| `admin`   | `admin123` |

ログインURL: `http://localhost:6969/auth/login`

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照してください。
