"""
Bluesky API Mock Module

This module provides mock implementations of Bluesky API functions
for testing and development purposes.

Usage:
    # In your code, import from this module to use mock
    from app.services.bluesky_mock import get_profile, authenticate_account, ...
    
    # Or use the mock_all function to replace the original module
    from app.services import bluesky_mock
    bluesky_mock.mock_all()
"""
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
import os

# Mock data storage
_mock_accounts: Dict[str, Dict[str, Any]] = {}
_mock_posts: List[Dict[str, Any]] = []
_mock_session_cache: Dict[str, Dict[str, Any]] = {}

# Flag to enable/disable mock
_mock_enabled = os.environ.get('USE_MOCK_BLUESKY', 'false').lower() == 'true'


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
    
    # Generate deterministic DID from identifier for consistency across restarts
    import hashlib
    deterministic_did = f'did:plc:{hashlib.md5(identifier.encode()).hexdigest()[:20]}'
    
    # Get or create mock account
    if identifier in _mock_accounts:
        account = _mock_accounts[identifier]
    else:
        # Create a new mock account
        account = {
            'did': deterministic_did,
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


class MockBlueskyClient:
    """Mock Bluesky client for testing purposes."""
    
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.session_data = {
            'username': username,
            'did': f'did:plc:{uuid.uuid4().hex[:20]}'
        }
    
    def login(self, identifier: str, password: str):
        """Mock login method."""
        if password == 'invalid':
            raise Exception("Invalid identifier or password")
        
        self.session_data['username'] = identifier
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


def mock_all():
    """
    Replace the original bluesky module functions with mock versions.
    This allows existing code to use the mock without changing imports.
    """
    import app.services.bluesky as bluesky_module
    
    # Store original functions
    bluesky_module._original_get_profile = bluesky_module.get_profile
    bluesky_module._original_authenticate_account = bluesky_module.authenticate_account
    bluesky_module._original_sync_account_profile = bluesky_module.sync_account_profile
    bluesky_module._original_create_client_with_encrypted_password = bluesky_module.create_client_with_encrypted_password
    bluesky_module._original_create_client = bluesky_module.create_client
    bluesky_module._original_get_bluesky_session = bluesky_module.get_bluesky_session
    bluesky_module._original_send_post = bluesky_module.send_post
    
    # Replace with mock functions
    bluesky_module.get_profile = get_profile
    bluesky_module.authenticate_account = authenticate_account
    bluesky_module.sync_account_profile = sync_account_profile
    bluesky_module.create_client_with_encrypted_password = create_client_with_encrypted_password
    bluesky_module.create_client = create_client
    bluesky_module.get_bluesky_session = get_bluesky_session
    bluesky_module.send_post = send_post
    
    print("Bluesky API mocked successfully")


def unmock_all():
    """
    Restore the original bluesky module functions.
    """
    import app.services.bluesky as bluesky_module
    
    if hasattr(bluesky_module, '_original_get_profile'):
        bluesky_module.get_profile = bluesky_module._original_get_profile
        bluesky_module.authenticate_account = bluesky_module._original_authenticate_account
        bluesky_module.sync_account_profile = bluesky_module._original_sync_account_profile
        bluesky_module.create_client_with_encrypted_password = bluesky_module._original_create_client_with_encrypted_password
        bluesky_module.create_client = bluesky_module._original_create_client
        bluesky_module.get_bluesky_session = bluesky_module._original_get_bluesky_session
        bluesky_module.send_post = bluesky_module._original_send_post
        
        print("Bluesky API unmocked - using real API")
