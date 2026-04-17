# Bluesky API Mock

Bluesky API のモック実装です。テストや開発環境で実際の API 呼び出しを行わずに動作を確認できます。

## 使い方

### 1. モック関数を直接使用

```python
from app.services.bluesky_mock import (
    get_profile,
    authenticate_account,
    send_post,
    MockBlueskyClient,
    reset_mock_data
)

# プロフィール取得
profile = await get_profile('username')

# 認証
result = await authenticate_account('username', 'password')

# 投稿
client = MockBlueskyClient('username', 'password')
result = await send_post(client, 'Hello Bluesky!')
```

### 2. 既存モジュールをモックに置き換え

```python
from app.services import bluesky_mock

# モックを有効化
bluesky_mock.mock_all()

# この行以降、app.services.bluesky の関数がモック版に置き換えられる
from app.services.bluesky import get_profile, authenticate_account

# 元に戻す
bluesky_mock.unmock_all()
```

### 3. 環境変数で制御

```bash
# 環境変数 BLUESKY_MOCK_ENABLED=true でモックを有効化
export BLUESKY_MOCK_ENABLED=true
```

## 提供される関数

### `get_profile(username: str)`
Bluesky のプロフィール情報を取得します。

### `authenticate_account(identifier: str, password: str)`
Bluesky アカウントの認証を行います。

特別なパスワード:
- `invalid`: 認証エラーを発生
- `ratelimit`: レートリミットエラーを発生

### `sync_account_profile(did, username, encrypted_password)`
アカウントプロフィールの同期を行います。

### `send_post(client, content, **kwargs)`
投稿を送信します。

### `create_client(username, password)`
Bluesky クライアントを作成します。

### `create_client_with_encrypted_password(username, encrypted_password)`
暗号化されたパスワードでクライアントを作成します。

## テストユーティリティ

### `reset_mock_data()`
モックデータをリセットします。

### `add_mock_account(username, did, display_name)`
モックアカウントを追加します。

### `get_mock_posts()`
モック投稿の一覧を取得します。

### `clear_mock_posts()`
モック投稿をクリアします。

### `get_post_count()`
モック投稿の数を取得します。

## テスト例

```python
import pytest
from app.services.bluesky_mock import (
    get_profile,
    authenticate_account,
    reset_mock_data,
    add_mock_account
)

@pytest.fixture(autouse=True)
def reset_mocks():
    reset_mock_data()
    yield
    reset_mock_data()

def test_get_profile():
    profile = asyncio.run(get_profile('testuser'))
    assert profile['handle'] == 'testuser'

def test_authenticate_invalid():
    result = asyncio.run(authenticate_account('user', 'invalid'))
    assert 'error' in result
```

## 注意点

- モックは永続化されません。テスト実行ごとに `reset_mock_data()` を呼び出すことを推奨します。
- 実際の API 応答とは形式が異なる場合があります。
- 本番環境では使用しないでください。
