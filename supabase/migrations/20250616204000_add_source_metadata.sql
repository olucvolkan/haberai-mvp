-- Add source_metadata column to news_articles table
-- This column will store MongoDB migration metadata as JSONB

ALTER TABLE news_articles 
ADD COLUMN source_metadata JSONB DEFAULT '{}';

-- Add index for source_metadata queries
CREATE INDEX IF NOT EXISTS idx_news_articles_source_metadata ON news_articles USING GIN (source_metadata);

-- Add comment for documentation
COMMENT ON COLUMN news_articles.source_metadata IS 'MongoDB migration metadata including original IDs, categories, topics, and other source-specific data'; 