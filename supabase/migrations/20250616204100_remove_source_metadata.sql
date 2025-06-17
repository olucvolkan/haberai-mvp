-- Remove source_metadata column from news_articles table
-- This column is not needed for the migration process

-- Drop the index first
DROP INDEX IF EXISTS idx_news_articles_source_metadata;

-- Remove the column
ALTER TABLE news_articles 
DROP COLUMN IF EXISTS source_metadata; 