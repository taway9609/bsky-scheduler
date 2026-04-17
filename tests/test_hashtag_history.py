"""
Tests for hashtag history API endpoints.

Tests the GET /hashtags and POST /hashtags/clear endpoints.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class TestGetHashtagHistory:
    """Tests for GET /hashtags endpoint."""

    @pytest.mark.asyncio
    async def test_get_empty_hashtag_history(self):
        """Empty history should return empty data list."""
        from app.api import bluesky

        mock_db = AsyncMock(spec=AsyncSession)
        mock_user = MagicMock(spec=User)
        mock_user.id = 1

        class MockQuery:
            def __init__(self, items):
                self._items = items

            def scalars(self):
                return self

            def all(self):
                return self._items

        mock_query = MockQuery([])

        def execute_side_effect(query):
            return mock_query

        mock_db.execute = AsyncMock(side_effect=execute_side_effect)

        with patch('app.api.bluesky.get_db', lambda: mock_db):
            with patch('app.api.bluesky.get_current_user', return_value=mock_user):
                result = await bluesky.get_hashtag_history(
                    db=mock_db,
                    current_user=mock_user
                )

        assert result['status'] == 'success'
        assert result['data'] == []

    @pytest.mark.asyncio
    async def test_get_hashtag_history_with_hashtags(self):
        """History with hashtags should return tag list."""
        from app.api import bluesky

        mock_db = AsyncMock(spec=AsyncSession)
        mock_user = MagicMock(spec=User)
        mock_user.id = 1

        mock_usages = [
            MagicMock(tag="python"),
            MagicMock(tag="fastapi"),
            MagicMock(tag="bluesky"),
        ]

        class MockQuery:
            def __init__(self, items):
                self._items = items

            def scalars(self):
                return self

            def all(self):
                return self._items

        mock_query = MockQuery(mock_usages)

        def execute_side_effect(query):
            return mock_query

        mock_db.execute = AsyncMock(side_effect=execute_side_effect)

        with patch('app.api.bluesky.get_db', lambda: mock_db):
            with patch('app.api.bluesky.get_current_user', return_value=mock_user):
                result = await bluesky.get_hashtag_history(
                    db=mock_db,
                    current_user=mock_user
                )

        assert result['status'] == 'success'
        assert len(result['data']) == 3
        assert "python" in result['data']


class TestClearHashtagHistory:
    """Tests for POST /hashtags/clear endpoint."""

    @pytest.mark.asyncio
    async def test_clear_hashtag_history(self):
        """Clear history should delete all hashtags for user."""
        from app.api import bluesky

        mock_db = AsyncMock(spec=AsyncSession)
        mock_user = MagicMock(spec=User)
        mock_user.id = 1

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        with patch('app.api.bluesky.get_db', lambda: mock_db):
            with patch('app.api.bluesky.get_current_user', return_value=mock_user):
                result = await bluesky.clear_hashtag_history(
                    db=mock_db,
                    current_user=mock_user
                )

        assert result['status'] == 'success'
        assert 'クリアしました' in result['message']
        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_clear_empty_history(self):
        """Clearing empty history should succeed."""
        from app.api import bluesky

        mock_db = AsyncMock(spec=AsyncSession)
        mock_user = MagicMock(spec=User)
        mock_user.id = 1

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        with patch('app.api.bluesky.get_db', lambda: mock_db):
            with patch('app.api.bluesky.get_current_user', return_value=mock_user):
                result = await bluesky.clear_hashtag_history(
                    db=mock_db,
                    current_user=mock_user
                )

        assert result['status'] == 'success'