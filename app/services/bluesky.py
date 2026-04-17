from typing import Optional
from app.config import settings
import os

# Check if mock mode is enabled
USE_MOCK = os.environ.get('USE_MOCK_BLUESKY', 'false').lower() == 'true'

if USE_MOCK:
    print("Bluesky API Mock is ENABLED")
    from app.services.bluesky_mock import (
        get_profile,
        authenticate_account,
        sync_account_profile,
        create_client_with_encrypted_password,
        create_client,
        get_bluesky_session,
        send_post,
        MockBlueskyClient,
        reset_mock_data,
        add_mock_account,
        get_mock_posts,
        clear_mock_posts,
        get_post_count
    )
else:
    def _get_client_class():
        from atproto import Client
        return Client


    async def get_profile(username: str):
        try:
            Client = _get_client_class()
            client = Client()
            profile = client.get_profile(username)
            return profile
        except Exception as e:
            print(f"DEBUG get_profile exception: {e}")
            return None


    async def authenticate_account(identifier: str, password: str) -> dict:
        try:
            print(f"DEBUG authenticate_account: identifier={identifier}")
            Client = _get_client_class()
            print(f"DEBUG Client class: {Client}")
            client = Client()
            print(f"DEBUG client: {client}")
            profile = client.login(identifier, password)
            print(f"DEBUG profile: {profile}")

            did = profile.did
            username = profile.handle
            display_name = getattr(profile, 'display_name', '') or ''

            return {
                'did': did,
                'username': username,
                'display_name': display_name
            }
        except Exception as e:
            print(f"DEBUG authenticate_account exception: {e}")
            error_str = str(e)
            if 'Invalid identifier or password' in error_str:
                return {'error': 'ユーザー名またはパスワードが正しくありません'}
            elif 'AuthenticationRequired' in error_str:
                return {'error': 'ユーザー名またはパスワードが正しくありません'}
            elif 'RateLimitError' in error_str or 'ratelimit' in error_str.lower():
                return {'error': 'ログイン試行回数が多すぎます。しばらくしてから再試行してください'}
            else:
                return {'error': 'ログインに失敗しました。認証情報を確認してください'}


    async def sync_account_profile(did: str, username: str, encrypted_password: str) -> dict:
        try:
            from app.utils.crypto import decrypt_password
            Client = _get_client_class()
            client = Client()
            password = decrypt_password(encrypted_password)
            client.login(username, password)

            profile = client.get_profile(username)
            display_name = getattr(profile, 'display_name', '') or ''

            return {
                'display_name': display_name,
                'success': True
            }
        except Exception as e:
            return {'error': str(e), 'success': False}


    def create_client_with_encrypted_password(username: str, encrypted_password: str):
        from app.utils.crypto import decrypt_password
        Client = _get_client_class()
        client = Client()
        password = decrypt_password(encrypted_password)
        client.login(username, password)
        return client


    def create_client(username: str, password: str):
        Client = _get_client_class()
        client = Client()
        client.login(username, password)
        return client


    async def get_bluesky_session(did: str, username: str, encrypted_password: str):
        from app.cache import get_cached_session, cache_session
        from app.utils.crypto import decrypt_password

        Client = _get_client_class()

        cached = await get_cached_session(did)
        if cached:
            client = Client()
            password = decrypt_password(cached['encrypted_password'])
            client.login(cached['username'], password)
            return client

        client = Client()
        password = decrypt_password(encrypted_password)
        client.login(username, password)

        await cache_session(did, {'username': username, 'encrypted_password': encrypted_password})

        return client


    async def send_post(client, content: str, **kwargs):
        try:
            post = client.send_post(
                text=content,
                **kwargs
            )
            return {'success': True, 'uri': post.uri, 'cid': post.cid}
        except Exception as e:
            return {'success': False, 'error': str(e)}