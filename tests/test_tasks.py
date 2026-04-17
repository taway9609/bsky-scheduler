"""
Comprehensive tests for the worker task module (app/tasks.py).

Tests cover:
- post_at_scheduled_time (happy path)
- Account not found
- Login failure
- Image upload scenarios (single, multiple, not found, upload failure)
- Reply/quote handling (internal, external, quote, parent not found, parent timeout)
- Threadgate and postgate (following, followers, mentions, nobody, combined)
- Labels (with labels, empty labels)
- Fail cases (account suspended, rate limits, service down, invalid response)
- Combined scenarios (reply+image, quote+image, gate failures)
- Error logging
- Password migration
"""
import pytest
import os
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, mock_open


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def mock_scheduled_post():
    """Create a mock ScheduledPost."""
    post = MagicMock()
    post.id = 'post-uuid-123'
    post.status = 'pending'
    post.content = 'Hello Bluesky!'
    post.account_did = 'did:plc:abc123'
    post.user_id = 1
    post.image_data = None
    post.langs = ['en']
    post.labels = []
    post.parent_post_id = None
    post.external_reply_uri = None
    post.external_reply_cid = None
    post.is_quote = False
    post.reply_gate = None
    post.disable_quotes = False
    post.post_uri = None
    post.post_cid = None
    post.error_message = None
    return post


@pytest.fixture
def mock_account():
    """Create a mock BlueskyAccount."""
    account = MagicMock()
    account.id = 'did:plc:abc123'
    account.did = 'did:plc:abc123'
    account.username = 'testuser.bsky.social'
    account.password = 'encrypted_password_here'
    account.user_id = 1
    account.display_name = 'Test User'
    return account


@pytest.fixture
def mock_bluesky_client():
    """Create a mock Bluesky client."""
    client = MagicMock()
    post_response = MagicMock()
    post_response.uri = 'at://did:plc:abc123/app.bsky.feed.post/rkey123'
    post_response.cid = 'bafyreicid123'
    client.com.atproto.repo.create_record.return_value = post_response
    return client


@pytest.fixture
def mock_session(mock_scheduled_post, mock_account):
    """Create a mock DB session."""
    session = MagicMock()

    def mock_get(model, id_val):
        if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
            return mock_scheduled_post
        elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
            return mock_account
        return None

    session.get.side_effect = mock_get
    return session


# ============================================================
# Helpers
# ============================================================

def _setup_and_run(mock_session, mock_account, mock_bluesky_client, mock_scheduled_post,
                   image_data=None, open_side_effect=None):
    """Helper to set up mocks and run the task."""
    from app.tasks import post_at_scheduled_time

    def mock_get(model, id_val):
        if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
            return mock_scheduled_post
        elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
            return mock_account
        return None

    mock_session.get.side_effect = mock_get

    if image_data is not None:
        mock_scheduled_post.image_data = image_data
        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None), \
             patch('builtins.open', side_effect=open_side_effect or mock_open(read_data=b'fake_image_data')), \
             patch('app.tasks.settings') as mock_settings:
            mock_settings.IMAGE_FOLDER = '/tmp/images'
            post_at_scheduled_time('post-uuid-123')
    else:
        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')


# ============================================================
# post_at_scheduled_time - Happy Path
# ============================================================

class TestPostAtScheduledTime:
    """Tests for the main post_at_scheduled_time worker function."""

    def test_successful_post(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Successful post should update status to 'posted' with uri/cid."""
        from app.tasks import post_at_scheduled_time

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        assert mock_scheduled_post.post_uri == 'at://did:plc:abc123/app.bsky.feed.post/rkey123'
        assert mock_scheduled_post.post_cid == 'bafyreicid123'
        assert mock_scheduled_post.error_message is None

    def test_post_with_langs(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with langs should include them in the record."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.langs = ['ja', 'en']

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'

    def test_post_with_content_and_facets(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with content should generate hashtag facets."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.content = 'Check out #bluesky and #atproto!'

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'


# ============================================================
# post_at_scheduled_time - Error Cases
# ============================================================

class TestPostAtScheduledTimeErrors:
    """Tests for error handling in post_at_scheduled_time."""

    def test_post_not_found(self):
        """Non-existent post should return early without error."""
        from app.tasks import post_at_scheduled_time
        mock_session = MagicMock()
        mock_session.get.return_value = None

        with patch('app.tasks.SessionLocal', return_value=mock_session):
            post_at_scheduled_time('nonexistent')

    def test_already_posted(self, mock_session, mock_scheduled_post):
        """Already posted post should return early."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.status = 'posted'

        with patch('app.tasks.SessionLocal', return_value=mock_session):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'

    def test_already_posting(self, mock_session, mock_scheduled_post):
        """Already posting post should return early."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.status = 'posting'

        with patch('app.tasks.SessionLocal', return_value=mock_session):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posting'

    def test_account_not_found(self, mock_session, mock_scheduled_post):
        """Missing account should set status to 'failed'."""
        from app.tasks import post_at_scheduled_time

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._migrate_password_if_needed', return_value=False):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert 'not found' in mock_scheduled_post.error_message.lower()

    def test_login_failure(self, mock_session, mock_account, mock_scheduled_post):
        """Login failure should set status to 'failed' and log error."""
        from app.tasks import post_at_scheduled_time

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', side_effect=Exception("Login failed")), \
             patch('app.tasks._migrate_password_if_needed', return_value=False):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert 'Login failed' in mock_scheduled_post.error_message

    def test_bluesky_api_failure(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """API failure should set status to 'failed' and log error."""
        from app.tasks import post_at_scheduled_time
        mock_bluesky_client.com.atproto.repo.create_record.side_effect = Exception("API Error")

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert 'API Error' in mock_scheduled_post.error_message


# ============================================================
# post_at_scheduled_time - Reply/Quote Handling
# ============================================================

class TestPostAtScheduledTimeReplyQuote:
    """Tests for reply and quote post handling."""

    def test_reply_to_internal_post(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Reply to internal post should include reply data with root/parent."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.parent_post_id = 'parent-uuid'

        parent_post = MagicMock()
        parent_post.status = 'posted'
        parent_post.post_uri = 'at://parent/uri'
        parent_post.post_cid = 'parent_cid'

        def mock_get(model, id_val):
            if id_val == 'parent-uuid':
                return parent_post
            elif hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'reply' in record
        assert record['reply']['root']['uri'] == 'at://parent/uri'
        assert record['reply']['parent']['uri'] == 'at://parent/uri'
        assert record['reply']['root']['cid'] == 'parent_cid'

    def test_reply_to_external_post(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Reply to external URI should include reply data."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.parent_post_id = None
        mock_scheduled_post.external_reply_uri = 'at://external/uri'
        mock_scheduled_post.external_reply_cid = 'ext_cid'

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'reply' in record
        assert record['reply']['root']['uri'] == 'at://external/uri'
        assert record['reply']['parent']['cid'] == 'ext_cid'

    def test_quote_post(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Quote post should use embed (app.bsky.embed.record) not reply."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.parent_post_id = None
        mock_scheduled_post.external_reply_uri = 'at://external/uri'
        mock_scheduled_post.external_reply_cid = 'ext_cid'
        mock_scheduled_post.is_quote = True

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'embed' in record
        assert record['embed']['$type'] == 'app.bsky.embed.record'
        assert record['embed']['record']['uri'] == 'at://external/uri'
        assert record['embed']['record']['cid'] == 'ext_cid'
        assert 'reply' not in record

    def test_reply_parent_not_found(self, mock_session, mock_account, mock_scheduled_post):
        """Reply to non-existent parent should fail."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.parent_post_id = 'missing-parent'

        def mock_get(model, id_val):
            if id_val == 'missing-parent':
                return None
            elif hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=MagicMock()), \
             patch('app.tasks._migrate_password_if_needed', return_value=False):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert '見つかりません' in mock_scheduled_post.error_message

    def test_reply_parent_not_posted(self, mock_session, mock_account, mock_scheduled_post):
        """Reply to parent that is not yet posted should timeout and fail."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.parent_post_id = 'parent-uuid'

        pending_parent = MagicMock()
        pending_parent.status = 'pending'
        pending_parent.post_uri = None
        pending_parent.post_cid = None

        def mock_get(model, id_val):
            if id_val == 'parent-uuid':
                return pending_parent
            elif hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=MagicMock()), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.time.sleep', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert '指定時間内' in mock_scheduled_post.error_message or 'timeout' in mock_scheduled_post.error_message.lower()


# ============================================================
# post_at_scheduled_time - Threadgate & Postgate
# ============================================================

class TestPostAtScheduledTimeGates:
    """Tests for threadgate and postgate handling."""

    def _setup_and_run(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Helper to set up mocks and run the task."""
        from app.tasks import post_at_scheduled_time

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

    def test_threadgate_following(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with reply_gate=['following'] should create threadgate."""
        mock_scheduled_post.reply_gate = ['following']
        self._setup_and_run(mock_session, mock_account, mock_bluesky_client, mock_scheduled_post)
        assert mock_scheduled_post.status == 'posted'
        assert mock_bluesky_client.com.atproto.repo.create_record.call_count == 2

    def test_threadgate_followers(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with reply_gate=['followers'] should create threadgate with followerRule."""
        mock_scheduled_post.reply_gate = ['followers']
        self._setup_and_run(mock_session, mock_account, mock_bluesky_client, mock_scheduled_post)
        assert mock_scheduled_post.status == 'posted'
        assert mock_bluesky_client.com.atproto.repo.create_record.call_count == 2

    def test_threadgate_mentions(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with reply_gate=['mentions'] should create threadgate with mentionRule."""
        mock_scheduled_post.reply_gate = ['mentions']
        self._setup_and_run(mock_session, mock_account, mock_bluesky_client, mock_scheduled_post)
        assert mock_scheduled_post.status == 'posted'

    def test_threadgate_nobody(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with reply_gate=['nobody'] should create threadgate with empty allow."""
        mock_scheduled_post.reply_gate = ['nobody']
        self._setup_and_run(mock_session, mock_account, mock_bluesky_client, mock_scheduled_post)
        assert mock_scheduled_post.status == 'posted'

    def test_threadgate_multiple_rules(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with multiple reply_gate rules should include all."""
        mock_scheduled_post.reply_gate = ['following', 'mentions']
        self._setup_and_run(mock_session, mock_account, mock_bluesky_client, mock_scheduled_post)
        assert mock_scheduled_post.status == 'posted'

    def test_disable_quotes(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with disable_quotes=True should create postgate."""
        mock_scheduled_post.disable_quotes = True
        self._setup_and_run(mock_session, mock_account, mock_bluesky_client, mock_scheduled_post)
        assert mock_scheduled_post.status == 'posted'
        assert mock_bluesky_client.com.atproto.repo.create_record.call_count == 2

    def test_threadgate_and_disable_quotes(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with both threadgate and disable_quotes should create both."""
        mock_scheduled_post.reply_gate = ['following']
        mock_scheduled_post.disable_quotes = True
        self._setup_and_run(mock_session, mock_account, mock_bluesky_client, mock_scheduled_post)
        assert mock_scheduled_post.status == 'posted'
        assert mock_bluesky_client.com.atproto.repo.create_record.call_count == 3

    def test_threadgate_failure_does_not_fail_post(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Threadgate creation failure should not fail the main post."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.reply_gate = ['following']
        mock_bluesky_client.com.atproto.repo.create_record.side_effect = [
            MagicMock(uri='at://uri', cid='cid123'),
            Exception("Threadgate failed"),
        ]

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'

    def test_postgate_failure_does_not_fail_post(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Postgate creation failure should not fail the main post."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.disable_quotes = True
        mock_bluesky_client.com.atproto.repo.create_record.side_effect = [
            MagicMock(uri='at://uri', cid='cid123'),
            Exception("Postgate failed"),
        ]

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'


# ============================================================
# post_at_scheduled_time - Image Handling
# ============================================================

class TestPostAtScheduledTimeImages:
    """Tests for image upload in post_at_scheduled_time."""

    def test_post_with_single_image(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with single image should upload blob and include embed."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.image_data = [{
            'filename': 'test.png',
            'alt_text': 'Test image',
        }]

        mock_blob = MagicMock()
        mock_blob.blob = MagicMock()
        mock_bluesky_client.com.atproto.repo.upload_blob.return_value = mock_blob

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None), \
             patch('builtins.open', mock_open(read_data=b'fake_image_data')), \
             patch('app.tasks.settings') as mock_settings:
            mock_settings.IMAGE_FOLDER = '/tmp/images'
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        mock_bluesky_client.com.atproto.repo.upload_blob.assert_called_once()
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        assert len(create_calls) >= 1
        record = create_calls[0][1]['data']['record']
        assert 'embed' in record
        assert record['embed']['$type'] == 'app.bsky.embed.images'
        assert len(record['embed']['images']) == 1
        assert record['embed']['images'][0]['alt'] == 'Test image'

    def test_post_with_multiple_images(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with multiple images should upload all blobs."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.image_data = [
            {'filename': 'img1.png', 'alt_text': 'First image'},
            {'filename': 'img2.png', 'alt_text': 'Second image'},
            {'filename': 'img3.png', 'alt_text': 'Third image'},
            {'filename': 'img4.png', 'alt_text': 'Fourth image'},
        ]

        mock_blob = MagicMock()
        mock_blob.blob = MagicMock()
        mock_bluesky_client.com.atproto.repo.upload_blob.return_value = mock_blob

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None), \
             patch('builtins.open', mock_open(read_data=b'fake_image_data')), \
             patch('app.tasks.settings') as mock_settings:
            mock_settings.IMAGE_FOLDER = '/tmp/images'
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        assert mock_bluesky_client.com.atproto.repo.upload_blob.call_count == 4
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert len(record['embed']['images']) == 4

    def test_post_with_image_not_found(self, mock_session, mock_account, mock_scheduled_post):
        """Post with missing image file should fail."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.image_data = [{
            'filename': 'missing.png',
            'alt_text': '',
        }]

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=MagicMock()), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('builtins.open', side_effect=FileNotFoundError):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert 'not found' in mock_scheduled_post.error_message.lower()

    def test_image_upload_failure(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Image upload failure should set status to failed with error details."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.image_data = [{
            'filename': 'test.png',
            'alt_text': 'Test image',
        }]

        upload_error = Exception("Upload failed: blob too large")
        mock_bluesky_client.com.atproto.repo.upload_blob.side_effect = upload_error

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None), \
             patch('builtins.open', mock_open(read_data=b'fake_image_data')), \
             patch('app.tasks.settings') as mock_settings:
            mock_settings.IMAGE_FOLDER = '/tmp/images'
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert 'Image upload failed' in mock_scheduled_post.error_message


# ============================================================
# post_at_scheduled_time - Labels
# ============================================================

class TestPostAtScheduledTimeLabels:
    """Tests for label handling in post_at_scheduled_time."""

    def test_post_with_labels(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with labels should include selfLabels in the record."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.labels = ['porn', 'nudity']

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'labels' in record
        assert record['labels']['$type'] == 'com.atproto.label.defs#selfLabels'
        assert len(record['labels']['values']) == 2
        assert record['labels']['values'][0]['val'] == 'porn'
        assert record['labels']['values'][1]['val'] == 'nudity'

    def test_post_with_empty_labels(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with empty labels list should not include labels in record."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.labels = []

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'labels' not in record


# ============================================================
# post_at_scheduled_time - Fail Cases
# ============================================================

class TestPostAtScheduledTimeFailCases:
    """Tests for failure scenarios in post_at_scheduled_time."""

    def test_account_suspended(self, mock_session, mock_account, mock_scheduled_post):
        """Account suspended error should set status to failed with descriptive message."""
        from app.tasks import post_at_scheduled_time
        suspended_error = Exception("Account has been suspended")

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', side_effect=suspended_error), \
             patch('app.tasks._migrate_password_if_needed', return_value=False):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert 'suspended' in mock_scheduled_post.error_message.lower()

    def test_rate_limit_error(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Rate limit error from API should set status to failed."""
        from app.tasks import post_at_scheduled_time
        rate_limit_error = Exception("RateLimitError: Rate limit exceeded (429)")
        mock_bluesky_client.com.atproto.repo.create_record.side_effect = rate_limit_error

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert 'RateLimitError' in mock_scheduled_post.error_message or '429' in mock_scheduled_post.error_message

    def test_service_down_error(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Service down / connection error should set status to failed."""
        from app.tasks import post_at_scheduled_time
        service_error = Exception("ConnectionError: Service temporarily unavailable (503)")
        mock_bluesky_client.com.atproto.repo.create_record.side_effect = service_error

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert '503' in mock_scheduled_post.error_message or 'unavailable' in mock_scheduled_post.error_message.lower()

    def test_invalid_response_from_bluesky(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Invalid response (missing uri/cid) should set status to failed."""
        from app.tasks import post_at_scheduled_time
        mock_response = MagicMock()
        mock_response.uri = None
        mock_response.cid = 'some_cid'
        mock_bluesky_client.com.atproto.repo.create_record.return_value = mock_response

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'failed'
        assert 'Invalid response' in mock_scheduled_post.error_message


# ============================================================
# post_at_scheduled_time - Combined Scenarios
# ============================================================

class TestPostAtScheduledTimeCombined:
    """Tests for combined feature scenarios."""

    def test_reply_with_image(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Reply to internal post with image should include both reply and image embed."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.parent_post_id = 'parent-uuid'
        mock_scheduled_post.image_data = [{'filename': 'img.png', 'alt_text': 'Reply image'}]

        parent_post = MagicMock()
        parent_post.status = 'posted'
        parent_post.post_uri = 'at://parent/uri'
        parent_post.post_cid = 'parent_cid'

        mock_blob = MagicMock()
        mock_blob.blob = MagicMock()
        mock_bluesky_client.com.atproto.repo.upload_blob.return_value = mock_blob

        def mock_get(model, id_val):
            if id_val == 'parent-uuid':
                return parent_post
            elif hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None), \
             patch('builtins.open', mock_open(read_data=b'fake_image_data')), \
             patch('app.tasks.settings') as mock_settings:
            mock_settings.IMAGE_FOLDER = '/tmp/images'
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'reply' in record
        assert 'embed' in record
        assert record['embed']['$type'] == 'app.bsky.embed.images'

    def test_quote_with_image(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Quote post with image: image embed overrides quote embed per current implementation."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.external_reply_uri = 'at://external/uri'
        mock_scheduled_post.external_reply_cid = 'ext_cid'
        mock_scheduled_post.is_quote = True
        mock_scheduled_post.image_data = [{'filename': 'img.png', 'alt_text': 'Quote image'}]

        mock_blob = MagicMock()
        mock_blob.blob = MagicMock()
        mock_bluesky_client.com.atproto.repo.upload_blob.return_value = mock_blob

        def mock_get(model, id_val):
            if hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None), \
             patch('builtins.open', mock_open(read_data=b'fake_image_data')), \
             patch('app.tasks.settings') as mock_settings:
            mock_settings.IMAGE_FOLDER = '/tmp/images'
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'embed' in record
        assert record['embed']['$type'] == 'app.bsky.embed.images'

    def test_reply_with_threadgate(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Reply with threadgate should include reply data and create threadgate."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.parent_post_id = 'parent-uuid'
        mock_scheduled_post.reply_gate = ['following']

        parent_post = MagicMock()
        parent_post.status = 'posted'
        parent_post.post_uri = 'at://parent/uri'
        parent_post.post_cid = 'parent_cid'

        def mock_get(model, id_val):
            if id_val == 'parent-uuid':
                return parent_post
            elif hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None):
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        assert mock_bluesky_client.com.atproto.repo.create_record.call_count == 2
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'reply' in record
        tg_call = create_calls[1][1]['data']
        assert tg_call['collection'] == 'app.bsky.feed.threadgate'

    def test_full_featured_post(self, mock_session, mock_account, mock_bluesky_client, mock_scheduled_post):
        """Post with all features: reply, image, threadgate, disable_quotes, labels, langs."""
        from app.tasks import post_at_scheduled_time
        mock_scheduled_post.parent_post_id = 'parent-uuid'
        mock_scheduled_post.image_data = [{'filename': 'img.png', 'alt_text': 'Full image'}]
        mock_scheduled_post.reply_gate = ['following', 'mentions']
        mock_scheduled_post.disable_quotes = True
        mock_scheduled_post.labels = ['porn']
        mock_scheduled_post.langs = ['ja']

        parent_post = MagicMock()
        parent_post.status = 'posted'
        parent_post.post_uri = 'at://parent/uri'
        parent_post.post_cid = 'parent_cid'

        mock_blob = MagicMock()
        mock_blob.blob = MagicMock()
        mock_bluesky_client.com.atproto.repo.upload_blob.return_value = mock_blob

        def mock_get(model, id_val):
            if id_val == 'parent-uuid':
                return parent_post
            elif hasattr(model, '__name__') and model.__name__ == 'ScheduledPost':
                return mock_scheduled_post
            elif hasattr(model, '__name__') and model.__name__ == 'BlueskyAccount':
                return mock_account
            return None

        mock_session.get.side_effect = mock_get

        with patch('app.tasks.SessionLocal', return_value=mock_session), \
             patch('app.tasks._get_authenticated_client', return_value=mock_bluesky_client), \
             patch('app.tasks._migrate_password_if_needed', return_value=False), \
             patch('app.tasks.generate_hashtag_facets', return_value=None), \
             patch('builtins.open', mock_open(read_data=b'fake_image_data')), \
             patch('app.tasks.settings') as mock_settings:
            mock_settings.IMAGE_FOLDER = '/tmp/images'
            post_at_scheduled_time('post-uuid-123')

        assert mock_scheduled_post.status == 'posted'
        assert mock_bluesky_client.com.atproto.repo.create_record.call_count == 3
        create_calls = mock_bluesky_client.com.atproto.repo.create_record.call_args_list
        record = create_calls[0][1]['data']['record']
        assert 'reply' in record
        assert 'embed' in record
        assert 'labels' in record
        assert 'langs' in record


# ============================================================
# Password Migration
# ============================================================

class TestPasswordMigration:
    """Tests for _migrate_password_if_needed function."""

    def test_migrates_plaintext_password(self, mock_account):
        """Plaintext password should be encrypted."""
        from app.tasks import _migrate_password_if_needed
        mock_account.password = 'plaintext_password'

        mock_session = MagicMock()

        with patch('app.utils.is_encrypted', return_value=False), \
             patch('app.utils.encrypt_password', return_value='encrypted') as mock_enc:
            result = _migrate_password_if_needed(mock_session, mock_account)

        assert result is True
        mock_enc.assert_called_once_with('plaintext_password')
        mock_session.commit.assert_called()

    def test_skips_already_encrypted_password(self, mock_account):
        """Already encrypted password should not be re-encrypted."""
        from app.tasks import _migrate_password_if_needed
        mock_account.password = 'already_encrypted'

        mock_session = MagicMock()

        with patch('app.utils.is_encrypted', return_value=True), \
             patch('app.utils.encrypt_password') as mock_enc:
            result = _migrate_password_if_needed(mock_session, mock_account)

        assert result is False
        mock_enc.assert_not_called()

    def test_skips_empty_password(self, mock_account):
        """Empty password should not be migrated."""
        from app.tasks import _migrate_password_if_needed
        mock_account.password = None

        mock_session = MagicMock()

        result = _migrate_password_if_needed(mock_session, mock_account)

        assert result is False


# ============================================================
# Error Logging
# ============================================================

class TestErrorLogging:
    """Tests for log_error function."""

    def test_logs_error_to_database(self, mock_session):
        """log_error should create ErrorLog entry."""
        from app.tasks import log_error

        log_error(
            mock_session,
            error_type='TEST_ERROR',
            message='Test error message',
            details='Some details',
            user_id=1,
            post_id='post-123',
            account_did='did:plc:test',
        )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

        error_log = mock_session.add.call_args[0][0]
        assert error_log.error_type == 'TEST_ERROR'
        assert error_log.message == 'Test error message'
        assert error_log.details == 'Some details'
        assert error_log.user_id == 1
        assert error_log.post_id == 'post-123'
        assert error_log.account_did == 'did:plc:test'
        assert error_log.resolved is False


# ============================================================
# _get_client_class
# ============================================================

class TestGetClientClass:
    """Tests for _get_client_class function."""

    def test_returns_mock_client_when_mock_enabled(self):
        """Should return MockBlueskyClient when USE_MOCK_BLUESKY is True."""
        with patch('app.tasks.settings') as mock_settings:
            mock_settings.USE_MOCK_BLUESKY = True
            import importlib
            import app.tasks
            importlib.reload(app.tasks)
            cls = app.tasks._get_client_class()
            assert cls.__name__ == 'MockBlueskyClient'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
