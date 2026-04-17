-- Migration: Add foreign key constraints and performance indexes
-- Date: 2024-03-23
-- Description:
--   - Add ondelete='CASCADE' to foreign key constraints
--   - Add performance indexes for frequently queried columns

-- ============================================================================
-- PERFORMANCE INDEXES (Safe to create anytime)
-- ============================================================================

-- ScheduledPost indexes
CREATE INDEX IF NOT EXISTS ix_scheduled_post_user_id ON scheduled_post (user_id);
CREATE INDEX IF NOT EXISTS ix_scheduled_post_schedule_time ON scheduled_post (schedule_time);
CREATE INDEX IF NOT EXISTS ix_scheduled_post_status ON scheduled_post (status);

-- HashtagUsage indexes
CREATE INDEX IF NOT EXISTS ix_hashtag_usage_user_id ON hashtag_usage (user_id);

-- ErrorLog indexes
CREATE INDEX IF NOT EXISTS ix_error_log_user_id ON error_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_error_log_created_at ON error_logs (created_at);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS with CASCADE
-- Note: These require finding and dropping existing constraints first.
-- ============================================================================

-- First, drop existing foreign key constraints if they exist
-- We'll need to find constraint names dynamically or specify them

-- For scheduled_post.account_did
ALTER TABLE scheduled_post DROP CONSTRAINT IF EXISTS scheduled_post_account_did_fkey;
ALTER TABLE scheduled_post ADD CONSTRAINT scheduled_post_account_did_fkey
    FOREIGN KEY (account_did) REFERENCES bluesky_account(did) ON DELETE CASCADE;

-- For scheduled_post.user_id
ALTER TABLE scheduled_post DROP CONSTRAINT IF EXISTS scheduled_post_user_id_fkey;
ALTER TABLE scheduled_post ADD CONSTRAINT scheduled_post_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- For scheduled_post.parent_post_id (self-reference)
ALTER TABLE scheduled_post DROP CONSTRAINT IF EXISTS scheduled_post_parent_post_id_fkey;
ALTER TABLE scheduled_post ADD CONSTRAINT scheduled_post_parent_post_id_fkey
    FOREIGN KEY (parent_post_id) REFERENCES scheduled_post(id) ON DELETE CASCADE;

-- For hashtag_usage.user_id
ALTER TABLE hashtag_usage DROP CONSTRAINT IF EXISTS hashtag_usage_user_id_fkey;
ALTER TABLE hashtag_usage ADD CONSTRAINT hashtag_usage_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- For error_logs.user_id
ALTER TABLE error_logs DROP CONSTRAINT IF EXISTS error_logs_user_id_fkey;
ALTER TABLE error_logs ADD CONSTRAINT error_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

