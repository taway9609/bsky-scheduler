"""
Tests for utility functions in app/utils.py
"""
import pytest
from app.utils import at_uri_to_https_url


class TestAtUriToHttpsUrl:
    """Tests for at_uri_to_https_url function."""

    def test_converts_basic_at_uri(self):
        """Basic at:// URI should be converted to https:// URL."""
        at_uri = "at://handle.bsky.social/app.bsky.feed.post/post123"
        result = at_uri_to_https_url(at_uri)
        assert result == "https://bsky.app/profile/handle.bsky.social/post/post123"

    def test_converts_at_uri_with_did(self):
        """at:// URI with DID should be converted to https:// URL."""
        at_uri = "at://did:plc:abc123/app.bsky.feed.post/post456"
        result = at_uri_to_https_url(at_uri)
        assert result == "https://bsky.app/profile/did:plc:abc123/post/post456"

    def test_handles_empty_string(self):
        """Empty string should return empty string."""
        result = at_uri_to_https_url("")
        assert result == ""

    def test_handles_none(self):
        """None should return None."""
        result = at_uri_to_https_url(None)
        assert result is None

    def test_handles_invalid_uri(self):
        """Invalid URI should return original string."""
        invalid_uri = "not-a-valid-uri"
        result = at_uri_to_https_url(invalid_uri)
        assert result == invalid_uri

    def test_handles_uri_without_post(self):
        """URI without post should return original string."""
        uri = "at://handle.bsky.social/app.bsky.feed.post"
        result = at_uri_to_https_url(uri)
        assert result == uri

    def test_handles_uri_with_different_collection(self):
        """URI with different collection should be converted correctly."""
        at_uri = "at://handle.bsky.social/app.bsky.feed.like/like123"
        result = at_uri_to_https_url(at_uri)
        assert result == "https://bsky.app/profile/handle.bsky.social/post/like123"

    def test_handles_uri_with_extra_path(self):
        """URI with extra path should be converted correctly."""
        at_uri = "at://handle.bsky.social/app.bsky.feed.post/post123/extra"
        result = at_uri_to_https_url(at_uri)
        assert result == "https://bsky.app/profile/handle.bsky.social/post/post123"
