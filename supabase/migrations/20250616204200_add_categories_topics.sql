-- Add categories and topics columns to news_articles table
-- These will store arrays of category/topic names as JSONB

-- Add categories column
ALTER TABLE news_articles 
ADD COLUMN categories JSONB DEFAULT '[]'::jsonb;

-- Add topics column  
ALTER TABLE news_articles 
ADD COLUMN topics JSONB DEFAULT '[]'::jsonb;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_news_articles_categories 
ON news_articles USING GIN (categories);

CREATE INDEX IF NOT EXISTS idx_news_articles_topics 
ON news_articles USING GIN (topics);

-- Add comments for documentation
COMMENT ON COLUMN news_articles.categories IS 'Array of category names/IDs as JSONB';
COMMENT ON COLUMN news_articles.topics IS 'Array of topic names/IDs as JSONB'; 