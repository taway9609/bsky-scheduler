import os
import time
import logging
import base64
import re
from datetime import datetime, timezone
from rq.job import Job
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import ScheduledPost, BlueskyAccount, ErrorLog
from app.utils import generate_hashtag_facets


def _get_client_class():
    if settings.USE_MOCK_BLUESKY:
        from tests.utils.mock_bluesky import MockBlueskyClient
        return MockBlueskyClient
    from atproto import Client
    return Client


def _get_authenticated_client(account: BlueskyAccount):
    """Get authenticated Bluesky client using encrypted password."""
    from app.services.bluesky_client import get_client_with_encrypted_password
    return get_client_with_encrypted_password(account.username, account.password)


def _migrate_password_if_needed(session, account: BlueskyAccount) -> bool:
    """Migrate plaintext password to encrypted format.

    Returns True if password was migrated, False otherwise.
    """
    from app.utils import encrypt_password, is_encrypted

    if not account.password:
        return False

    # まず is_encrypted で確認（例外をキャッチするため）
    if is_encrypted(account.password):
        return False

    # is_encributed が False でも、Fernet トークン形式の場合は
    # 既に暗号化されているが復号できない（例: 鍵の変更）と判断してスキップ
    # Fernet トークンは base64url エンコードされ、通常 50 文字以上
    password_str = str(account.password or '')
    if len(password_str) >= 40 and re.match(r'^[A-Za-z0-9_-]+$', password_str):
        try:
            # デコード可能か試す
            base64.urlsafe_b64decode(password_str + '==')
            logger.warning(f"Password for {account.username} appears to be encrypted but cannot be decrypted. Skipping migration to avoid data loss.")
            return False
        except Exception:
            pass  # デコードできなければ平文の可能性

    # 平文と判断して暗号化
    logger.info(f"Migrating plaintext password to encrypted for account: {account.username}")
    account.password = encrypt_password(account.password)
    session.commit()
    return True

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = create_engine(settings.SYNC_DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def log_error(session, error_type, message, details=None, user_id=None, post_id=None, account_did=None):
    try:
        error_log = ErrorLog(
            error_type=error_type,
            message=message,
            details=details,
            user_id=user_id,
            post_id=post_id,
            account_did=account_did,
            resolved=False
        )
        session.add(error_log)
        session.commit()
    except Exception as e:
        logger.error(f"Failed to log error: {e}")


def post_at_scheduled_time(post_id: str):
    session = SessionLocal()
    
    try:
        post = session.get(ScheduledPost, post_id)
        if not post or post.status == 'posted':
            return
        if post.status == 'posting':
            return
        
        original_status = post.status
        post.status = 'posting'
        post.error_message = None
        session.commit()
        
        account = session.get(BlueskyAccount, post.account_did)
        if not account:
            post.status = 'failed'
            post.error_message = 'Account not found.'
            session.commit()
            session.close()
            return
        
        _migrate_password_if_needed(session, account)
        
        try:
            client = _get_authenticated_client(account)
        except Exception as e:
            logger.error(f"Account login failed for {account.username}: {str(e)}")
            session = SessionLocal()
            post = session.get(ScheduledPost, post_id)
            post.status = 'failed'
            post.error_message = f"Account login failed: {e}"
            log_error(session, "LOGIN_FAILED", f"Account login failed for {account.username}", str(e), account.user_id, post_id, account.did)
            session.commit()
            session.close()
            return
        
        images = None
        alt_texts = None
        aspect_ratios = None
        if post.image_data:
            images = []
            alt_texts = []
            aspect_ratios = []
            for img_data in post.image_data:
                try:
                    from PIL import Image
                    import io
                    img_path = os.path.join(settings.IMAGE_FOLDER, img_data['filename'])
                    with open(img_path, 'rb') as img_file:
                        img_bytes = img_file.read()
                        images.append(img_bytes)
                    
                    # Get image dimensions for aspect ratio
                    try:
                        img = Image.open(io.BytesIO(img_bytes))
                        width, height = img.size
                        aspect_ratios.append({
                            'width': width,
                            'height': height
                        })
                    except Exception:
                        aspect_ratios.append(None)
                    
                    alt_texts.append(img_data.get('alt_text', ''))
                except FileNotFoundError:
                    session = SessionLocal()
                    post = session.get(ScheduledPost, post_id)
                    post.status = 'failed'
                    post.error_message = f"Image file {img_data['filename']} not found."
                    log_error(session, "IMAGE_NOT_FOUND", f"Image file {img_data['filename']} not found", None, post.user_id, post_id, post.account_did)
                    session.commit()
                    session.close()
                    return
        
        reply_to_data = None
        embed_data = None
        
        session = SessionLocal()
        post = session.get(ScheduledPost, post_id)
        
        if post.parent_post_id:
            MAX_REPLY_WAIT_ATTEMPTS = 12
            REPLY_WAIT_SECONDS = 5
            parent_post_id_val = post.parent_post_id
            
            for attempt in range(MAX_REPLY_WAIT_ATTEMPTS):
                parent_post_data = session.get(ScheduledPost, parent_post_id_val)
                if parent_post_data:
                    if parent_post_data.status == 'posted' and parent_post_data.post_uri and parent_post_data.post_cid:
                        reply_to_data = {
                            'root': {
                                'uri': parent_post_data.post_uri,
                                'cid': parent_post_data.post_cid
                            },
                            'parent': {
                                'uri': parent_post_data.post_uri,
                                'cid': parent_post_data.post_cid
                            }
                        }
                        break
                    else:
                        time.sleep(REPLY_WAIT_SECONDS)
                else:
                    post.status = 'failed'
                    post.error_message = '返信先の投稿が見つかりません。'
                    log_error(session, "REPLY_POST_NOT_FOUND", "返信先の投稿が見つかりません", f"Parent post ID: {parent_post_id_val}", post.user_id, post_id, post.account_did)
                    session.commit()
                    session.close()
                    return
            
            if not reply_to_data:
                post.status = 'failed'
                post.error_message = '返信先の投稿が指定時間内に投稿されませんでした。'
                log_error(session, "REPLY_TIMEOUT", "返信先の投稿が指定時間内に投稿されませんでした", f"Parent post ID: {parent_post_id_val}, waited {MAX_REPLY_WAIT_ATTEMPTS * REPLY_WAIT_SECONDS} seconds", post.user_id, post_id, post.account_did)
                session.commit()
                session.close()
                return
        elif post.external_reply_uri and post.external_reply_cid:
            if post.is_quote:
                embed_data = {
                    '$type': 'app.bsky.embed.record',
                    'record': {
                        'uri': post.external_reply_uri,
                        'cid': post.external_reply_cid
                    }
                }
            else:
                reply_to_data = {
                    'root': {
                        'uri': post.external_reply_uri,
                        'cid': post.external_reply_cid
                    },
                    'parent': {
                        'uri': post.external_reply_uri,
                        'cid': post.external_reply_cid
                    }
                }
        
        try:
            created_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            
            post_record = {
                '$type': 'app.bsky.feed.post',
                'text': post.content or '',
                'createdAt': created_at,
            }
            
            if post.langs:
                post_record['langs'] = post.langs
            
            if post.content:
                facets = generate_hashtag_facets(post.content)
                if facets:
                    post_record['facets'] = facets
            
            if post.labels and isinstance(post.labels, list) and len(post.labels) > 0:
                post_record['labels'] = {
                    '$type': 'com.atproto.label.defs#selfLabels',
                    'values': [{'val': label} for label in post.labels]
                }
            
            if reply_to_data:
                post_record['reply'] = {
                    'root': reply_to_data['root'],
                    'parent': reply_to_data['parent']
                }
            
            if embed_data:
                post_record['embed'] = embed_data
            
            image_blobs = []
            if images:
                for i, img_data in enumerate(images):
                    alt = alt_texts[i] if i < len(alt_texts) else ''
                    try:
                        blob = client.com.atproto.repo.upload_blob(img_data)
                        img_entry = {
                            'image': blob.blob,
                            'alt': alt
                        }
                        # Add aspect ratio if available
                        if aspect_ratios and i < len(aspect_ratios) and aspect_ratios[i]:
                            img_entry['aspectRatio'] = aspect_ratios[i]
                        image_blobs.append(img_entry)
                    except Exception as e:
                        logger.error(f"Failed to upload image {i}: {e}")
                        session = SessionLocal()
                        post = session.get(ScheduledPost, post_id)
                        post.status = 'failed'
                        post.error_message = f"Image upload failed: {str(e)}"
                        log_error(session, "IMAGE_UPLOAD_FAILED", f"Failed to upload image {i}", str(e), post.user_id, post_id, account.did)
                        session.commit()
                        session.close()
                        return
            
            if image_blobs:
                post_record['embed'] = {
                    '$type': 'app.bsky.embed.images',
                    'images': image_blobs
                }
            
            post_response = client.com.atproto.repo.create_record(
                data={
                    'repo': account.did,
                    'collection': 'app.bsky.feed.post',
                    'record': post_record,
                }
            )
            post_uri = post_response.uri
            post_cid = post_response.cid
            
            if not post_uri or not post_cid:
                raise Exception(f"Invalid response from Bluesky API")
            
            if post.reply_gate and isinstance(post.reply_gate, list):
                allow_rules = []
                create_threadgate = False
                
                for gate in post.reply_gate:
                    if gate == 'following':
                        allow_rules.append({'$type': 'app.bsky.feed.threadgate#followingRule'})
                        create_threadgate = True
                    elif gate == 'followers':
                        allow_rules.append({'$type': 'app.bsky.feed.threadgate#followerRule'})
                        create_threadgate = True
                    elif gate == 'mentions':
                        allow_rules.append({'$type': 'app.bsky.feed.threadgate#mentionRule'})
                        create_threadgate = True
                    elif gate == 'nobody':
                        allow_rules = []
                        create_threadgate = True
                
                if create_threadgate:
                    try:
                        rkey = post_uri.split('/')[-1]
                        client.com.atproto.repo.create_record(
                            data={
                                'repo': account.did,
                                'collection': 'app.bsky.feed.threadgate',
                                'rkey': rkey,
                                'record': {
                                    '$type': 'app.bsky.feed.threadgate',
                                    'post': post_uri,
                                    'allow': allow_rules,
                                    'createdAt': created_at,
                                }
                            }
                        )
                    except Exception as e:
                        logger.warning(f"Failed to set threadgate: {e}")
            
            if post.disable_quotes:
                try:
                    rkey = post_uri.split('/')[-1]
                    embedding_rules = []
                    if post.disable_quotes:
                        embedding_rules.append({
                            "$type": "app.bsky.feed.postgate#disableRule"
                        })
                    
                    client.com.atproto.repo.create_record(
                        data={
                            'repo': account.did,
                            'collection': 'app.bsky.feed.postgate',
                            'rkey': rkey,
                            'record': {
                                '$type': 'app.bsky.feed.postgate',
                                'post': post_uri,
                                'embeddingRules': embedding_rules,
                                'createdAt': created_at,
                            }
                        }
                    )
                    logger.info(f"Successfully set postgate for post: {post_uri}")
                except Exception as e:
                    logger.error(f"Failed to set postgate for {post_uri}: {e}")
            
            post.status = 'posted'
            post.post_uri = post_uri
            post.post_cid = post_cid
            post.error_message = None
            logger.info(f"Successfully posted to Bluesky: uri={post_uri}, cid={post_cid}")
        except Exception as e:
            logger.error(f"Error posting to Bluesky for post {post_id}: {str(e)}")
            post.status = 'failed'
            post.error_message = str(e)[:500]
            log_error(session, "POST_FAILED", "Failed to post to Bluesky", str(e), post.user_id, post_id, post.account_did)
        
        session.commit()
        session.close()
        
    except Exception as e:
        logger.error(f"Error in post_at_scheduled_time for post {post_id}: {str(e)}")
        try:
            session = SessionLocal()
            post = session.get(ScheduledPost, post_id)
            if post:
                post.status = 'failed'
                post.error_message = str(e)
                log_error(session, "UNKNOWN_ERROR", "Unexpected error in post_at_scheduled_time", str(e), getattr(post, 'user_id', None), post_id, getattr(post, 'account_did', None))
                session.commit()
        except Exception:
            pass
        finally:
            session.close()
