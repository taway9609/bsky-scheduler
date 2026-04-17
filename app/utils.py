import os
import re
import uuid
import binascii
import socket
import subprocess
import threading
import logging
import io
from logging.handlers import TimedRotatingFileHandler
import platform
from PIL import Image

if platform.system() == 'Windows':
    CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW
else:
    CREATE_NO_WINDOW = 0

logger = logging.getLogger(__name__)

MAX_IMAGE_SIZE = 976 * 1024
TARGET_SIZE = 950 * 1024

def setup_logging(app):
    log_file = os.path.join('logs', 'app.log')
    file_handler = TimedRotatingFileHandler(log_file, when='midnight', interval=1, backupCount=7, encoding='utf-8')
    file_handler.setLevel(logging.ERROR)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.DEBUG)


def guess_extension(image_bytes: bytes) -> str:
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return '.png'
    elif image_bytes[:2] == b'\xff\xd8':
        return '.jpg'
    elif image_bytes[:6] in (b'GIF87a', b'GIF89a'):
        return '.gif'
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        return '.webp'
    return '.jpg'


def convert_to_webp(image_bytes: bytes, target_size: int = TARGET_SIZE) -> bytes:
    logger.debug(f"Converting image to WebP. Target size: {target_size} bytes")
    
    img = Image.open(io.BytesIO(image_bytes))
    logger.debug(f"Image opened. Dimensions: {img.width}x{img.height}, Mode: {img.mode}")
    
    if img.mode == 'P':
        img = img.convert('RGBA')
        logger.debug("Converted from palette mode to RGBA")
    elif img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGB')
        logger.debug(f"Converted from {img.mode} mode to RGB")
    
    quality = 95
    min_quality = 50
    output = io.BytesIO()
    
    logger.debug("Starting quality adjustment loop")
    while quality >= min_quality:
        output.seek(0)
        output.truncate()
        img.save(output, format='WEBP', quality=quality, method=6)
        
        if output.tell() <= target_size:
            logger.debug(f"Quality {quality} meets target size: {output.tell()} bytes")
            break
        
        quality -= 5
        logger.debug(f"Reducing quality to {quality}")
    
    if output.tell() > target_size:
        logger.debug("Quality adjustment failed. Resizing image...")
        ratio = (target_size / output.tell()) ** 0.5
        new_width = max(1, int(img.width * ratio))
        new_height = max(1, int(img.height * ratio))
        logger.debug(f"Resizing from {img.width}x{img.height} to {new_width}x{new_height}")
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=80, method=6)
        logger.debug(f"Resized image size: {output.tell()} bytes")
    
    final_size = output.tell()
    logger.debug(f"WebP conversion completed. Final size: {final_size} bytes")
    return output.getvalue()


def optimize_image(image_bytes: bytes):
    logger.debug(f"Optimizing image. Original size: {len(image_bytes)} bytes")
    original_ext = guess_extension(image_bytes)

    if original_ext == '.webp' and len(image_bytes) <= MAX_IMAGE_SIZE:
        logger.debug(f"Image is already WebP and within size limit. Keeping original.")
        return image_bytes, '.webp'

    logger.debug(f"Converting to WebP for optimization...")
    webp_bytes = convert_to_webp(image_bytes)
    logger.debug(f"WebP conversion completed. Original: {len(image_bytes)} bytes -> Optimized: {len(webp_bytes)} bytes")
    return webp_bytes, '.webp'

def extract_hashtags_from_text(text):
    if not text:
        return []
    regex = r"[#＆]([a-zA-Z0-9_\-ぁ-んァ-ヶー一-龠]+)"
    matches = re.findall(regex, text)
    return list(dict.fromkeys(matches))


def generate_hashtag_facets(text):
    """Generate Bluesky facets for hashtags in text.
    
    Returns a list of facet dicts for hashtags found in the text.
    Each facet has: index (ByteSlice), and features (Tag).
    Uses camelCase for JSON serialization to atproto API.
    """
    return generate_facets(text)


def generate_facets(text, resolve_handle_func=None):
    """Generate Bluesky facets for mentions, links, and hashtags in text.
    
    Uses manual facet generation since TextBuilder has issues with byte positions.
    
    Args:
        text: The post content text
        resolve_handle_func: Optional function to resolve handle to DID for mentions
        
    Returns a list of facet dicts. Each facet has: index (ByteSlice), and features.
    Uses camelCase for JSON serialization to atproto API.
    """
    return _generate_facets_manual(text, resolve_handle_func)


def _generate_facets_manual(text, resolve_handle_func=None):
    """Fallback manual facet generation without TextBuilder."""
    if not text:
        return []
    
    facets = []
    text_bytes = text.encode('utf-8')
    words = text.split()
    
    word_data = [(w, w.encode('utf-8')) for w in words]
    current_byte_pos = 0
    
    for word, word_encoded in word_data:
        word_len = len(word_encoded)
        segment = text_bytes[current_byte_pos:current_byte_pos + word_len]
        
        if segment == word_encoded:
            clean_word = word.rstrip(',.!?;:')
            byte_start = current_byte_pos
            byte_end = current_byte_pos + word_len
            
            facet = None
            
            if clean_word.startswith(('@', '#', '＞')) or clean_word.startswith(('http://', 'https://')):
                facet = {
                    "index": {
                        "byteStart": byte_start,
                        "byteEnd": byte_end
                    },
                    "features": []
                }
                
                if clean_word.startswith('@'):
                    handle = clean_word[1:]
                    did = None
                    if resolve_handle_func:
                        did = resolve_handle_func(handle)
                    if did:
                        facet["features"].append({
                            "$type": "app.bsky.richtext.facet#mention",
                            "did": did
                        })
                    else:
                        facet["features"].append({
                            "$type": "app.bsky.richtext.facet#mention",
                            "did": f"did:plc:unresolved:{handle}"
                        })
                elif clean_word.startswith(('http://', 'https://')):
                    facet["features"].append({
                        "$type": "app.bsky.richtext.facet#link",
                        "uri": clean_word
                    })
                elif (clean_word.startswith('#') or clean_word.startswith('＞')) and len(clean_word) > 1:
                    tag_content = clean_word[1:] if clean_word.startswith('#') else clean_word[1:]
                    facet["features"].append({
                        "$type": "app.bsky.richtext.facet#tag",
                        "tag": tag_content
                    })
            
            if facet and facet["features"]:
                facets.append(facet)
            
            current_byte_pos += word_len
            while current_byte_pos < len(text_bytes) and text_bytes[current_byte_pos] in (32, 10, 13, 9):
                current_byte_pos += 1
        else:
            current_byte_pos += 1
    
    return facets

_fernet = None


def _get_fernet():
    """Get or create Fernet instance."""
    global _fernet
    if _fernet is None:
        from app.config import settings
        _fernet = __import__('cryptography.fernet', fromlist=['Fernet']).Fernet(settings.get_encryption_key().encode())
    return _fernet


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext value using Fernet symmetric encryption."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a ciphertext using Fernet symmetric encryption."""
    return _get_fernet().decrypt(ciphertext.encode()).decode()


def is_encrypted(value: str) -> bool:
    """Check if a value appears to be encrypted with Fernet."""
    if not value:
        return False
    try:
        _get_fernet().decrypt(value.encode())
        return True
    except Exception:
        return False


def encrypt_password(plaintext: str) -> str:
    """Encrypt a Bluesky password."""
    return encrypt_value(plaintext)


def decrypt_password(encrypted: str) -> str:
    """Decrypt a Bluesky password."""
    return decrypt_value(encrypted)


def at_uri_to_https_url(at_uri: str) -> str:
    """Convert at:// URI to https:// URL for Bluesky.
    
    Args:
        at_uri: The at:// URI to convert (e.g., "at://handle/app.bsky.feed.post/post_id")
        
    Returns:
        The https:// URL (e.g., "https://bsky.app/profile/handle/post/post_id")
        or the original string if conversion fails.
        
    Examples:
        >>> at_uri_to_https_url("at://handle.bsky.social/app.bsky.feed.post/post123")
        "https://bsky.app/profile/handle.bsky.social/post/post123"
        >>> at_uri_to_https_url("at://did:plc:abc123/app.bsky.feed.post/post456")
        "https://bsky.app/profile/did:plc:abc123/post/post456"
    """
    if not at_uri:
        return at_uri
    
    if not at_uri.startswith("at://"):
        return at_uri
    
    try:
        # Remove "at://" prefix
        uri_without_prefix = at_uri[5:]
        
        # Split by "/" to get components
        parts = uri_without_prefix.split("/")
        
        # Expected format: handle/did/collection/rkey
        # We need: handle and rkey (the part after collection)
        if len(parts) < 3:
            return at_uri
        
        handle = parts[0]
        collection = parts[1]
        
        # Find the rkey (first part after collection)
        rkey = None
        if len(parts) > 2:
            # Check if the second part looks like a collection (contains a dot)
            if "." in collection:
                rkey = parts[2] if len(parts) > 2 else None
            else:
                # If no dot in second part, treat it as rkey
                rkey = collection
        
        if not rkey:
            return at_uri
        
        # Construct https:// URL
        return f"https://bsky.app/profile/{handle}/post/{rkey}"
    except Exception:
        return at_uri
