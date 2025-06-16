-- Function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE event_templates 
    SET usage_count = usage_count + 1 
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get channel statistics
CREATE OR REPLACE FUNCTION get_channel_stats(channel_uuid UUID)
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'total_articles', COUNT(CASE WHEN na.channel_id = channel_uuid THEN 1 END),
        'analyzed_articles', COUNT(CASE WHEN na.channel_id = channel_uuid AND na.analysis_completed = true THEN 1 END),
        'generated_content', COUNT(CASE WHEN gc.channel_id = channel_uuid THEN 1 END),
        'approved_content', COUNT(CASE WHEN gc.channel_id = channel_uuid AND gc.human_approved = true THEN 1 END),
        'event_templates', COUNT(CASE WHEN et.channel_id = channel_uuid THEN 1 END)
    ) INTO stats
    FROM news_channels nc
    LEFT JOIN news_articles na ON nc.id = na.channel_id
    LEFT JOIN generated_content gc ON nc.id = gc.channel_id
    LEFT JOIN event_templates et ON nc.id = et.channel_id
    WHERE nc.id = channel_uuid;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find similar events based on category and keywords
CREATE OR REPLACE FUNCTION find_similar_events(
    search_channel_id UUID,
    event_category_input VARCHAR(100),
    search_keywords TEXT[]
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    content TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        na.id,
        na.title,
        na.content,
        na.published_at,
        -- Simple similarity score based on keyword matches
        CASE 
            WHEN na.title IS NOT NULL AND na.content IS NOT NULL THEN
                (SELECT COUNT(*) FROM unnest(search_keywords) AS keyword 
                 WHERE na.title ILIKE '%' || keyword || '%' 
                    OR na.content ILIKE '%' || keyword || '%')::FLOAT / array_length(search_keywords, 1)
            ELSE 0.0
        END AS similarity_score
    FROM news_articles na
    JOIN event_templates et ON na.channel_id = et.channel_id
    WHERE na.channel_id = search_channel_id
        AND et.event_category = event_category_input
        AND na.analysis_completed = true
    ORDER BY similarity_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update channel analysis status
CREATE OR REPLACE FUNCTION update_channel_analysis_status(
    channel_uuid UUID,
    new_status VARCHAR(50)
)
RETURNS void AS $$
BEGIN
    IF new_status IN ('pending', 'in_progress', 'completed', 'failed') THEN
        UPDATE news_channels 
        SET analysis_status = new_status
        WHERE id = channel_uuid;
    ELSE
        RAISE EXCEPTION 'Invalid status: %', new_status;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_template_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_channel_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_events(UUID, VARCHAR(100), TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_channel_analysis_status(UUID, VARCHAR(50)) TO authenticated;
