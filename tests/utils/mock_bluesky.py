"""
Bluesky API Mock Module

This module provides mock implementations of Bluesky API functions
for testing and development purposes.
"""
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid


# Mock data storage
_mock_accounts: Dict[str, Dict[str, Any]] = {}
_mock_posts: List[Dict[str, Any]] = []
_mock_session_cache: Dict[str, Dict[str, Any]] = {}


def reset_mock_data():
    """Reset all mock data to initial state."""
    global _mock_accounts, _mock_posts, _mock_session_cache
    _mock_accounts = {}
    _mock_posts = []
    _mock_session_cache = {}


def add_mock_account(username: str, did: str, display_name: str = ""):
    """Add a mock account for testing."""
    _mock_accounts[username] = {
        'did': did,
        'username': username,
        'display_name': display_name
    }


def get_mock_posts() -> List[Dict[str, Any]]:
    """Get all mock posts."""
    return _mock_posts.copy()


async def get_profile(username: str) -> Optional[Dict[str, Any]]:
    """
    Mock implementation of get_profile.
    
    Returns a mock profile or None if not found.
    """
    if username in _mock_accounts:
        account = _mock_accounts[username]
        return {
            'did': account['did'],
            'handle': account['username'],
            'display_name': account.get('display_name', ''),
            'username': account['username']
        }
    # Return a default mock profile
    return {
        'did': f'did:plc:{uuid.uuid4().hex[:20]}',
        'handle': username,
        'display_name': username,
        'username': username
    }


async def authenticate_account(identifier: str, password: str) -> Dict[str, Any]:
    """
    Mock implementation of authenticate_account.
    
    Returns mock authentication result.
    """
    print(f"DEBUG authenticate_account (mock): identifier={identifier}")
    
    # Simulate authentication failure for specific credentials
    if password == 'invalid':
        return {'error': 'ユーザー名またはパスワードが正しくありません'}
    
    if password == 'ratelimit':
        return {'error': 'ログイン試行回数が多すぎます。しばらくしてから再試行してください'}
    
    # Get or create mock account
    if identifier in _mock_accounts:
        account = _mock_accounts[identifier]
    else:
        # Create a new mock account
        account = {
            'did': f'did:plc:{uuid.uuid4().hex[:20]}',
            'username': identifier,
            'display_name': identifier
        }
        _mock_accounts[identifier] = account
    
    return {
        'did': account['did'],
        'username': account['username'],
        'display_name': account.get('display_name', '')
    }


async def sync_account_profile(
    did: str, 
    username: str, 
    encrypted_password: str
) -> Dict[str, Any]:
    """
    Mock implementation of sync_account_profile.
    
    Returns mock profile sync result.
    """
    try:
        # Get or create mock account
        if username in _mock_accounts:
            account = _mock_accounts[username]
        else:
            account = {
                'did': did,
                'username': username,
                'display_name': username
            }
            _mock_accounts[username] = account
        
        return {
            'display_name': account.get('display_name', ''),
            'success': True
        }
    except Exception as e:
        return {'error': str(e), 'success': False}


def create_client_with_encrypted_password(username: str, encrypted_password: str):
    """
    Mock implementation of create_client_with_encrypted_password.
    
    Returns a mock client object.
    """
    return MockBlueskyClient(username, encrypted_password)


def create_client(username: str, password: str):
    """
    Mock implementation of create_client.
    
    Returns a mock client object.
    """
    return MockBlueskyClient(username, password)


async def get_bluesky_session(
    did: str, 
    username: str, 
    encrypted_password: str
) -> Any:
    """
    Mock implementation of get_bluesky_session.
    
    Returns a mock session/client.
    """
    # Check cache
    if did in _mock_session_cache:
        cached = _mock_session_cache[did]
        return MockBlueskyClient(cached['username'], cached['encrypted_password'])
    
    # Create new session
    client = MockBlueskyClient(username, encrypted_password)
    _mock_session_cache[did] = {
        'username': username,
        'encrypted_password': encrypted_password
    }
    
    return client


async def send_post(client, content: str, **kwargs) -> Dict[str, Any]:
    """
    Mock implementation of send_post.
    
    Returns mock post result.
    """
    post = {
        'uri': f'at://{client.username}/app.bsky.feed.post/{uuid.uuid4()}',
        'cid': f'cid_{uuid.uuid4().hex[:20]}',
        'content': content,
        'created_at': datetime.utcnow().isoformat()
    }
    _mock_posts.append(post)
    
    return {
        'success': True,
        'uri': post['uri'],
        'cid': post['cid']
    }


class MockBlob:
    """Mock blob object returned by upload_blob."""

    def __init__(self, data: bytes):
        self.data = data
        self.ref = {'$link': uuid.uuid4().hex}
        self.mime_type = 'image/jpeg'
        self.size = len(data)


class MockBlobResponse:
    """Mock response from upload_blob."""

    def __init__(self, data: bytes):
        self.blob = MockBlob(data)


class MockCreateRecordResponse:
    """Mock response from create_record."""

    def __init__(self, uri: str, cid: str):
        self.uri = uri
        self.cid = cid


class MockRepoAPI:
    """Mock com.atproto.repo namespace."""

    def __init__(self, client: 'MockBlueskyClient'):
        self._client = client

    def upload_blob(self, data: bytes) -> MockBlobResponse:
        return MockBlobResponse(data)

    def create_record(self, data: Dict[str, Any]) -> MockCreateRecordResponse:
        uri = f'at://{self._client.username}/app.bsky.feed.post/{uuid.uuid4()}'
        cid = f'cid_{uuid.uuid4().hex[:20]}'

        record = data.get('record', {})
        post_info = {
            'uri': uri,
            'cid': cid,
            'text': record.get('text', ''),
            'created_at': record.get('createdAt', ''),
            'repo': data.get('repo', ''),
            'collection': data.get('collection', ''),
        }
        _mock_posts.append(post_info)

        return MockCreateRecordResponse(uri, cid)


class MockComAPI:
    """Mock com namespace."""

    def __init__(self, client: 'MockBlueskyClient'):
        self.atproto = MockAtprotoAPI(client)


class MockAtprotoAPI:
    """Mock com.atproto namespace."""

    def __init__(self, client: 'MockBlueskyClient'):
        self.repo = MockRepoAPI(client)


class MockBlueskyClient:
    """Mock Bluesky client for testing purposes.

    Matches atproto.Client API:
    - Client() -> no-arg constructor
    - client.login(identifier, password) -> authenticates
    """

    def __init__(self, username: str = None, password: str = None):
        self.username = username
        self.password = password
        self.session_data = {
            'username': username,
            'did': f'did:plc:{uuid.uuid4().hex[:20]}'
        }
        self.com = MockComAPI(self)

    def login(self, identifier: str, password: str):
        """Mock login method."""
        if password == 'invalid':
            raise Exception("Invalid identifier or password")

        self.username = identifier
        self.password = password
        self.session_data['username'] = identifier
        self.session_data['did'] = f'did:plc:{uuid.uuid4().hex[:20]}'
        self.com = MockComAPI(self)
        return MockProfile(identifier)
    
    def get_profile(self, username: str):
        """Mock get_profile method."""
        if username in _mock_accounts:
            account = _mock_accounts[username]
            return MockProfile(
                username,
                account.get('did', f'did:plc:{uuid.uuid4().hex[:20]}'),
                account.get('display_name', '')
            )
        return MockProfile(username)
    
    def send_post(self, text: str, **kwargs):
        """Mock send_post method."""
        post = {
            'uri': f'at://{self.username}/app.bsky.feed.post/{uuid.uuid4()}',
            'cid': f'cid_{uuid.uuid4().hex[:20]}',
            'text': text
        }
        _mock_posts.append(post)
        return MockPost(post['uri'], post['cid'])
    
    def get_timeline(self, limit: int = 25):
        """Mock get_timeline method."""
        return MockResponse([])
    
    def get_author_feed(self, actor: str, limit: int = 25):
        """Mock get_author_feed method."""
        return MockResponse([])


class MockProfile:
    """Mock profile object."""
    
    def __init__(self, handle: str, did: str = None, display_name: str = None):
        self.handle = handle
        self.did = did or f'did:plc:{uuid.uuid4().hex[:20]}'
        self.display_name = display_name or handle
        self.username = handle
    
    def __getattr__(self, name: str):
        return None


class MockPost:
    """Mock post object."""
    
    def __init__(self, uri: str, cid: str):
        self.uri = uri
        self.cid = cid


class MockResponse:
    """Mock API response."""
    
    def __init__(self, data: Any):
        self.data = data
        self.posts = data if isinstance(data, list) else []


# Utility functions for testing
def set_mock_profile(username: str, profile_data: Dict[str, Any]):
    """Set mock profile data for a specific username."""
    _mock_accounts[username] = profile_data


def clear_mock_posts():
    """Clear all mock posts."""
    _mock_posts.clear()


def get_post_count() -> int:
    """Get count of mock posts."""
    return len(_mock_posts)
