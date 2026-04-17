"""Bluesky client factory with encrypted password support.

This module provides functions to create authenticated Bluesky clients
using encrypted passwords stored in the database.
"""

from typing import Optional
from app.config import settings


def _get_client_class():
    """Get the appropriate client class (real or mock)."""
    if settings.USE_MOCK_BLUESKY:
        from tests.utils.mock_bluesky import MockBlueskyClient
        return MockBlueskyClient
    from atproto import Client
    return Client


def get_client_with_encrypted_password(username: str, encrypted_password: str):
    """Create an authenticated Bluesky client using encrypted password.
    
    Args:
        username: Bluesky handle/username
        encrypted_password: Fernet-encrypted password
        
    Returns:
        Authenticated atproto Client instance
        
    Raises:
        Exception: If decryption or login fails
    """
    from app.utils import decrypt_password
    
    Client = _get_client_class()
    client = Client()
    
    password = decrypt_password(encrypted_password)
    client.login(username, password)
    
    return client


def get_client_with_plaintext_password(username: str, password: str):
    """Create an authenticated Bluesky client using plaintext password.
    
    This is useful during account registration when we need to verify
    credentials before encrypting and storing.
    
    Args:
        username: Bluesky handle/username
        password: Plaintext password
        
    Returns:
        Authenticated atproto Client instance
        
    Raises:
        Exception: If login fails
    """
    Client = _get_client_class()
    client = Client()
    client.login(username, password)
    return client
