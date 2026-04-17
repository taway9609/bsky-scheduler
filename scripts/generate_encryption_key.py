#!/usr/bin/env python3
"""Generate a Fernet encryption key for Bluesky password encryption.

This script generates a secure encryption key that should be added to your
.env file. The key is used to encrypt/decrypt Bluesky passwords stored in
the database.

Usage:
    python scripts/generate_encryption_key.py

Output:
    Generates a Fernet key and prints the ENCRYPTION_KEY=value line
    to add to your .env file.

Example:
    $ python scripts/generate_encryption_key.py
    Generated encryption key:
    ENCRYPTION_KEY=gAAAAABh...your-key-here...
    
    Add this to your .env file!
"""

from cryptography.fernet import Fernet


def generate_key():
    """Generate a new Fernet encryption key."""
    return Fernet.generate_key().decode()


def main():
    key = generate_key()
    print("Generated encryption key:")
    print()
    print(f"ENCRYPTION_KEY={key}")
    print()
    print("Add this to your docker-compose.yml:")
    print()
    print("  environment:")
    print("    ENCRYPTION_KEY: ${ENCRYPTION_KEY}")
    print()
    print("And to your .env file:")
    print()
    print(f"ENCRYPTION_KEY={key}")
    print()
    print("IMPORTANT: Keep this key safe! If you lose it, you cannot")
    print("decrypt your stored Bluesky passwords.")


if __name__ == "__main__":
    main()
