export interface NewsChannel {
  id: string;
  name: string;
  source_db_config: Record<string, any>;
  analysis_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ChannelProfile {
  id: string;
  channel_id: string;
  political_stance: Record<string, any>;
  language_style: Record<string, any>;
  confidence_score: number;
  analysis_date: string;
  created_at: string;
  updated_at: string;
}

export interface NewsArticle {
  id: string;
  channel_id: string;
  title: string;
  content: string;
  summary?: string;
  vector_id?: string;
  analysis_completed: boolean;
  published_at?: string;
  migrated_at: string;
  created_at: string;
  updated_at: string;
}

export interface EventTemplate {
  id: string;
  channel_id: string;
  event_category: string;
  language_template: string;
  effectiveness_score: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface GeneratedContent {
  id: string;
  channel_id: string;
  topic: string;
  content: string;
  content_type: 'article' | 'headline' | 'summary' | 'analysis';
  consistency_scores: Record<string, any>;
  human_approved: boolean;
  feedback?: string;
  generation_prompt?: string;
  model_used?: string;
  generation_time_ms?: number;
  created_at: string;
  updated_at: string;
}

// Database relationships
export interface NewsChannelWithProfile extends NewsChannel {
  profile?: ChannelProfile;
}

export interface NewsChannelWithArticles extends NewsChannel {
  articles?: NewsArticle[];
}

export interface GeneratedContentWithChannel extends GeneratedContent {
  channel: NewsChannel;
}

// API Request/Response types
export interface CreateChannelRequest {
  name: string;
  source_db_config: Record<string, any>;
}

export interface GenerateContentRequest {
  channelId: string;
  topic: string;
  contentType?: 'article' | 'headline' | 'summary' | 'analysis';
  targetAudience?: string;
  desiredLength?: 'short' | 'medium' | 'long';
}

export interface GenerateContentResponse {
  id: string;
  content: string;
  consistency_scores: Record<string, any>;
  generation_time_ms: number;
}

// Political analysis types
export interface PoliticalStance {
  economic: number; // -1 (left) to 1 (right)
  social: number; // -1 (progressive) to 1 (conservative)
  foreign_policy: number; // -1 (dove) to 1 (hawk)
  overall_bias: number; // -1 (left) to 1 (right)
  confidence: number; // 0 to 1
}

export interface LanguageStyle {
  formality: number; // 0 (informal) to 1 (formal)
  emotional_tone: number; // -1 (negative) to 1 (positive)
  complexity: number; // 0 (simple) to 1 (complex)
  sensationalism: number; // 0 (factual) to 1 (sensational)
  vocabulary_richness: number; // 0 to 1
}

// Vector database payload interface for Qdrant
export interface NewsEmbeddingPayload {
  channel_id: string;
  political_score: number;
  event_category: string;
  content_preview: string;
  published_at?: string;
  analysis_completed: boolean;
} 