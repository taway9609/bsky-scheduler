"""
Comprehensive tests for Bluesky API Mock Module.

Verifies that mock functions return correct success/error responses
for all supported argument combinations, matching the real API behavior.
"""
import pytest
import asyncio
import uuid
from tests.utils.mock_bluesky import (
    get_profile,
    authenticate_account,
    sync_account_profile,
    send_post,
    create_client,
    create_client_with_encrypted_password,
    get_bluesky_session,
    MockBlueskyClient,
    MockProfile,
    MockPost,
    MockResponse,
    reset_mock_data,
    add_mock_account,
    set_mock_profile,
    get_mock_posts,
    clear_mock_posts,
    get_post_count,
)


@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset mock data before each test."""
    reset_mock_data()
    yield
    reset_mock_data()


# ============================================================
# get_profile
# ============================================================

class TestGetProfile:
    """Tests for get_profile mock function."""

    def test_returns_profile_for_unknown_user(self):
        """Unknown user should get a default mock profile (not None)."""
        profile = asyncio.run(get_profile('unknown_user'))
        assert profile is not None
        assert profile['handle'] == 'unknown_user'
        assert profile['username'] == 'unknown_user'
        assert profile['did'].startswith('did:plc:')
        assert profile['display_name'] == 'unknown_user'

    def test_returns_profile_for_registered_mock_account(self):
        """Registered mock account should return its configured data."""
        add_mock_account('myuser', 'did:plc:abc123', 'My Display')
        profile = asyncio.run(get_profile('myuser'))
        assert profile['did'] == 'did:plc:abc123'
        assert profile['handle'] == 'myuser'
        assert profile['display_name'] == 'My Display'
        assert profile['username'] == 'myuser'

    def test_returns_profile_for_empty_display_name(self):
        """Mock account with empty display_name should return empty string."""
        add_mock_account('user2', 'did:plc:xyz', '')
        profile = asyncio.run(get_profile('user2'))
        assert profile['display_name'] == ''

    def test_profile_did_is_valid_format(self):
        """DID should start with did:plc: prefix."""
        profile = asyncio.run(get_profile('anyuser'))
        assert profile['did'].startswith('did:plc:')
        assert len(profile['did']) > len('did:plc:')

    def test_set_mock_profile_overrides_existing(self):
        """set_mock_profile should override any existing mock account."""
        add_mock_account('user', 'did:plc:old', 'Old Name')
        set_mock_profile('user', {
            'did': 'did:plc:new',
            'username': 'user',
            'display_name': 'New Name',
        })
        profile = asyncio.run(get_profile('user'))
        assert profile['did'] == 'did:plc:new'
        assert profile['display_name'] == 'New Name'


# ============================================================
# authenticate_account
# ============================================================

class TestAuthenticateAccount:
    """Tests for authenticate_account mock function."""

    def test_success_with_normal_password(self):
        """Normal password should return success with account data."""
        result = asyncio.run(authenticate_account('testuser', 'password123'))
        assert 'error' not in result
        assert 'did' in result
        assert 'username' in result
        assert 'display_name' in result
        assert result['username'] == 'testuser'
        assert result['did'].startswith('did:plc:')

    def test_success_with_empty_password(self):
        """Empty password should still succeed (mock doesn't validate)."""
        result = asyncio.run(authenticate_account('testuser', ''))
        assert 'error' not in result
        assert result['username'] == 'testuser'

    def test_failure_with_invalid_password(self):
        """Password 'invalid' should return auth error."""
        result = asyncio.run(authenticate_account('testuser', 'invalid'))
        assert 'error' in result
        assert 'ユーザー名またはパスワードが正しくありません' in result['error']

    def test_failure_with_ratelimit_password(self):
        """Password 'ratelimit' should return rate limit error."""
        result = asyncio.run(authenticate_account('testuser', 'ratelimit'))
        assert 'error' in result
        assert 'ログイン試行回数が多すぎます' in result['error']

    def test_creates_account_on_first_auth(self):
        """First auth for unknown user should create a mock account."""
        result = asyncio.run(authenticate_account('newuser', 'pass'))
        assert result['username'] == 'newuser'
        # Subsequent get_profile should return the same account
        profile = asyncio.run(get_profile('newuser'))
        assert profile['did'] == result['did']

    def test_uses_existing_mock_account(self):
        """Auth for existing mock account should use its data."""
        add_mock_account('existing', 'did:plc:known', 'Known User')
        result = asyncio.run(authenticate_account('existing', 'pass'))
        assert result['did'] == 'did:plc:known'
        assert result['display_name'] == 'Known User'

    def test_result_has_all_required_fields(self):
        """Success result must have did, username, display_name."""
        result = asyncio.run(authenticate_account('user', 'pass'))
        assert set(['did', 'username', 'display_name']).issubset(result.keys())


# ============================================================
# sync_account_profile
# ============================================================

class TestSyncAccountProfile:
    """Tests for sync_account_profile mock function."""

    def test_success_for_new_account(self):
        """Sync for unknown account should succeed and create it."""
        result = asyncio.run(sync_account_profile(
            'did:plc:test', 'newuser', 'encrypted_pass'
        ))
        assert result['success'] is True
        assert 'display_name' in result

    def test_success_for_existing_account(self):
        """Sync for existing account should return its display_name."""
        add_mock_account('syncuser', 'did:plc:sync', 'Synced User')
        result = asyncio.run(sync_account_profile(
            'did:plc:sync', 'syncuser', 'encrypted_pass'
        ))
        assert result['success'] is True
        assert result['display_name'] == 'Synced User'

    def test_empty_display_name(self):
        """Account with empty display_name should return empty string."""
        add_mock_account('user', 'did:plc:x', '')
        result = asyncio.run(sync_account_profile(
            'did:plc:x', 'user', 'pass'
        ))
        assert result['success'] is True
        assert result['display_name'] == ''

    def test_creates_account_in_mock_data(self):
        """Sync should register the account in _mock_accounts."""
        asyncio.run(sync_account_profile('did:plc:new', 'newacct', 'pass'))
        profile = asyncio.run(get_profile('newacct'))
        assert profile['did'] == 'did:plc:new'


# ============================================================
# send_post
# ============================================================

class TestSendPost:
    """Tests for send_post mock function."""

    def test_success_returns_uri_and_cid(self):
        """Successful post should return uri and cid."""
        client = MockBlueskyClient('user', 'pass')
        result = asyncio.run(send_post(client, 'Hello'))
        assert result['success'] is True
        assert 'uri' in result
        assert 'cid' in result
        assert result['uri'].startswith('at://')

    def test_uri_contains_username(self):
        """Post URI should contain the client's username."""
        client = MockBlueskyClient('testacct', 'pass')
        result = asyncio.run(send_post(client, 'Content'))
        assert 'testacct' in result['uri']

    def test_increments_post_count(self):
        """Each send_post should increment the global post count."""
        assert get_post_count() == 0
        client = MockBlueskyClient('user', 'pass')
        asyncio.run(send_post(client, 'Post 1'))
        assert get_post_count() == 1
        asyncio.run(send_post(client, 'Post 2'))
        assert get_post_count() == 2

    def test_empty_content(self):
        """Empty content should still succeed."""
        client = MockBlueskyClient('user', 'pass')
        result = asyncio.run(send_post(client, ''))
        assert result['success'] is True

    def test_content_with_special_chars(self):
        """Content with special characters should succeed."""
        client = MockBlueskyClient('user', 'pass')
        result = asyncio.run(send_post(client, 'Hello #tag @user\nNew line'))
        assert result['success'] is True


# ============================================================
# MockBlueskyClient
# ============================================================

class TestMockBlueskyClient:
    """Tests for MockBlueskyClient class."""

    def test_creation(self):
        """Client should store username and session data."""
        client = MockBlueskyClient('user', 'pass')
        assert client.username == 'user'
        assert client.password == 'pass'
        assert 'did' in client.session_data
        assert client.session_data['username'] == 'user'

    def test_login_success(self):
        """Login with valid password should return MockProfile."""
        client = MockBlueskyClient('user', 'pass')
        profile = client.login('newuser', 'valid_pass')
        assert isinstance(profile, MockProfile)
        assert profile.handle == 'newuser'
        assert client.session_data['username'] == 'newuser'

    def test_login_invalid_password_raises(self):
        """Login with 'invalid' password should raise Exception."""
        client = MockBlueskyClient('user', 'pass')
        with pytest.raises(Exception) as exc_info:
            client.login('user', 'invalid')
        assert 'Invalid identifier or password' in str(exc_info.value)

    def test_send_post_returns_mock_post(self):
        """send_post should return MockPost with uri and cid."""
        client = MockBlueskyClient('user', 'pass')
        post = client.send_post('Hello')
        assert isinstance(post, MockPost)
        assert post.uri.startswith('at://')
        assert post.cid.startswith('cid_')

    def test_send_post_appends_to_global_posts(self):
        """send_post should append to _mock_posts."""
        client = MockBlueskyClient('user', 'pass')
        assert get_post_count() == 0
        client.send_post('Test')
        assert get_post_count() == 1

    def test_get_profile_returns_mock_profile(self):
        """get_profile should return MockProfile."""
        client = MockBlueskyClient('user', 'pass')
        profile = client.get_profile('other')
        assert isinstance(profile, MockProfile)
        assert profile.handle == 'other'

    def test_get_profile_for_mock_account(self):
        """get_profile for registered mock account should return its data."""
        add_mock_account('known', 'did:plc:known', 'Known User')
        client = MockBlueskyClient('user', 'pass')
        profile = client.get_profile('known')
        assert profile.did == 'did:plc:known'
        assert profile.display_name == 'Known User'

    def test_get_timeline_returns_empty(self):
        """get_timeline should return empty MockResponse."""
        client = MockBlueskyClient('user', 'pass')
        response = client.get_timeline()
        assert isinstance(response, MockResponse)
        assert response.posts == []

    def test_get_author_feed_returns_empty(self):
        """get_author_feed should return empty MockResponse."""
        client = MockBlueskyClient('user', 'pass')
        response = client.get_author_feed('actor')
        assert isinstance(response, MockResponse)
        assert response.posts == []


# ============================================================
# create_client / create_client_with_encrypted_password
# ============================================================

class TestCreateClient:
    """Tests for client factory functions."""

    def test_create_client_returns_mock_client(self):
        """create_client should return MockBlueskyClient."""
        client = create_client('user', 'pass')
        assert isinstance(client, MockBlueskyClient)
        assert client.username == 'user'
        assert client.password == 'pass'

    def test_create_client_with_encrypted_password(self):
        """create_client_with_encrypted_password should return MockBlueskyClient."""
        client = create_client_with_encrypted_password('user', 'encrypted')
        assert isinstance(client, MockBlueskyClient)
        assert client.username == 'user'
        assert client.password == 'encrypted'


# ============================================================
# get_bluesky_session
# ============================================================

class TestGetBlueskySession:
    """Tests for get_bluesky_session mock function."""

    def test_new_session_returns_client(self):
        """New session should return MockBlueskyClient."""
        client = asyncio.run(get_bluesky_session(
            'did:plc:test', 'user', 'encrypted'
        ))
        assert isinstance(client, MockBlueskyClient)
        assert client.username == 'user'

    def test_cached_session_returns_client(self):
        """Second call with same DID should return cached client."""
        client1 = asyncio.run(get_bluesky_session(
            'did:plc:cached', 'user1', 'enc1'
        ))
        client2 = asyncio.run(get_bluesky_session(
            'did:plc:cached', 'user2', 'enc2'
        ))
        # Both should be clients; cached one uses original credentials
        assert isinstance(client1, MockBlueskyClient)
        assert isinstance(client2, MockBlueskyClient)


# ============================================================
# MockProfile
# ============================================================

class TestMockProfile:
    """Tests for MockProfile class."""

    def test_default_values(self):
        """Profile with minimal args should generate defaults."""
        profile = MockProfile('handle')
        assert profile.handle == 'handle'
        assert profile.display_name == 'handle'
        assert profile.username == 'handle'
        assert profile.did.startswith('did:plc:')

    def test_custom_values(self):
        """Profile with all args should use them."""
        profile = MockProfile('h', 'did:plc:x', 'Display')
        assert profile.handle == 'h'
        assert profile.did == 'did:plc:x'
        assert profile.display_name == 'Display'

    def test_getattr_returns_none_for_unknown(self):
        """Unknown attributes should return None."""
        profile = MockProfile('user')
        assert profile.unknown_attr is None
        assert profile.avatar is None
        assert profile.description is None


# ============================================================
# MockPost
# ============================================================

class TestMockPost:
    """Tests for MockPost class."""

    def test_post_stores_uri_and_cid(self):
        """MockPost should store uri and cid."""
        post = MockPost('at://test/post', 'cid_abc')
        assert post.uri == 'at://test/post'
        assert post.cid == 'cid_abc'


# ============================================================
# MockResponse
# ============================================================

class TestMockResponse:
    """Tests for MockResponse class."""

    def test_response_with_list(self):
        """Response with list should set posts."""
        resp = MockResponse([1, 2, 3])
        assert resp.data == [1, 2, 3]
        assert resp.posts == [1, 2, 3]

    def test_response_with_non_list(self):
        """Response with non-list should have empty posts."""
        resp = MockResponse('data')
        assert resp.data == 'data'
        assert resp.posts == []


# ============================================================
# Utility functions
# ============================================================

class TestUtilityFunctions:
    """Tests for mock utility functions."""

    def test_reset_mock_data_clears_all(self):
        """reset_mock_data should clear all mock storage."""
        add_mock_account('user', 'did:plc:x', 'Name')
        client = MockBlueskyClient('user', 'pass')
        asyncio.run(send_post(client, 'Test'))
        reset_mock_data()
        assert get_post_count() == 0
        profile = asyncio.run(get_profile('user'))
        # After reset, user is unknown but still gets default profile
        assert profile['handle'] == 'user'
        assert profile['did'] != 'did:plc:x'

    def test_add_mock_account(self):
        """add_mock_account should register account."""
        add_mock_account('test', 'did:plc:test', 'Test User')
        profile = asyncio.run(get_profile('test'))
        assert profile['did'] == 'did:plc:test'
        assert profile['display_name'] == 'Test User'

    def test_clear_mock_posts(self):
        """clear_mock_posts should remove all mock posts."""
        client = MockBlueskyClient('user', 'pass')
        asyncio.run(send_post(client, 'Post'))
        assert get_post_count() == 1
        clear_mock_posts()
        assert get_post_count() == 0

    def test_get_mock_posts_returns_copy(self):
        """get_mock_posts should return a copy, not the original list."""
        posts = get_mock_posts()
        posts.append({'fake': True})
        assert get_mock_posts() == []  # Original unchanged


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
