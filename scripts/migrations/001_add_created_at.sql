-- Migration: Add created_at column to scheduled_post table
-- Date: 2024-03-20
-- Description: Adds created_at timestamp for sorting posts by creation order

-- Add created_at column with default value of schedule_time for existing rows
ALTER TABLE scheduled_post 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to have created_at = schedule_time
UPDATE scheduled_post 
SET created_at = schedule_time 
WHERE created_at IS NULL OR created_at = CURRENT_TIMESTAMP;
