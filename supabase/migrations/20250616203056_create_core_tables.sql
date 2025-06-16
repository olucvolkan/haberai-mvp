-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

-- News channels table
CREATE TABLE IF NOT EXISTS news_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    source_db_config JSONB NOT NULL DEFAULT '{}',
    analysis_status VARCHAR(50) DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'in_progress', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channel profiles table (political and linguistic analysis results)
CREATE TABLE IF NOT EXISTS channel_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES news_channels(id) ON DELETE CASCADE,
    political_stance JSONB NOT NULL DEFAULT '{}', -- Multi-dimensional political stance data
    language_style JSONB NOT NULL DEFAULT '{}',   -- Language patterns and style characteristics
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id) -- One profile per channel
);

-- News articles table (migrated articles with vector references)
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES news_channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    vector_id VARCHAR(255), -- Reference to vector in Qdrant
    analysis_completed BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    migrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event templates table (event-based language templates)
CREATE TABLE IF NOT EXISTS event_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES news_channels(id) ON DELETE CASCADE,
    event_category VARCHAR(100) NOT NULL, -- e.g., 'economy', 'politics', 'sports'
    language_template TEXT NOT NULL,
    effectiveness_score DECIMAL(5,4) CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated content table (AI-generated content with quality metrics)
CREATE TABLE IF NOT EXISTS generated_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES news_channels(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'article' CHECK (content_type IN ('article', 'headline', 'summary', 'analysis')),
    consistency_scores JSONB NOT NULL DEFAULT '{}', -- Quality and consistency metrics
    human_approved BOOLEAN DEFAULT FALSE,
    feedback TEXT,
    generation_prompt TEXT,
    model_used VARCHAR(100),
    generation_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_news_channels_name ON news_channels(name);
CREATE INDEX IF NOT EXISTS idx_news_channels_status ON news_channels(analysis_status);

CREATE INDEX IF NOT EXISTS idx_channel_profiles_channel_id ON channel_profiles(channel_id);

CREATE INDEX IF NOT EXISTS idx_news_articles_channel_id ON news_articles(channel_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_vector_id ON news_articles(vector_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_news_articles_analysis_completed ON news_articles(analysis_completed);

CREATE INDEX IF NOT EXISTS idx_event_templates_channel_id ON event_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_event_templates_category ON event_templates(event_category);
CREATE INDEX IF NOT EXISTS idx_event_templates_effectiveness ON event_templates(effectiveness_score DESC);

CREATE INDEX IF NOT EXISTS idx_generated_content_channel_id ON generated_content(channel_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_type ON generated_content(content_type);
CREATE INDEX IF NOT EXISTS idx_generated_content_approved ON generated_content(human_approved);
CREATE INDEX IF NOT EXISTS idx_generated_content_created_at ON generated_content(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables
CREATE TRIGGER update_news_channels_updated_at BEFORE UPDATE ON news_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channel_profiles_updated_at BEFORE UPDATE ON channel_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_news_articles_updated_at BEFORE UPDATE ON news_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_templates_updated_at BEFORE UPDATE ON event_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_generated_content_updated_at BEFORE UPDATE ON generated_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE news_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (can be refined later based on auth requirements)
-- For now, allowing authenticated users to read all data and admin users to modify

-- News channels policies
CREATE POLICY "Allow read access to news_channels" ON news_channels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert access to news_channels" ON news_channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update access to news_channels" ON news_channels FOR UPDATE USING (auth.role() = 'authenticated');

-- Channel profiles policies
CREATE POLICY "Allow read access to channel_profiles" ON channel_profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert access to channel_profiles" ON channel_profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update access to channel_profiles" ON channel_profiles FOR UPDATE USING (auth.role() = 'authenticated');

-- News articles policies
CREATE POLICY "Allow read access to news_articles" ON news_articles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert access to news_articles" ON news_articles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update access to news_articles" ON news_articles FOR UPDATE USING (auth.role() = 'authenticated');

-- Event templates policies
CREATE POLICY "Allow read access to event_templates" ON event_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert access to event_templates" ON event_templates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update access to event_templates" ON event_templates FOR UPDATE USING (auth.role() = 'authenticated');

-- Generated content policies
CREATE POLICY "Allow read access to generated_content" ON generated_content FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert access to generated_content" ON generated_content FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update access to generated_content" ON generated_content FOR UPDATE USING (auth.role() = 'authenticated');
