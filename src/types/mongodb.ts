import { ObjectId } from 'mongodb'

// MongoDB Post structure based on the provided example
export interface MongoPost {
  _id: ObjectId
  is_old_record?: boolean
  weight?: number
  created_by?: number
  updated_by?: number
  deleted_by?: number
  integer_id?: number
  old_id?: number
  post_type?: number
  author_id?: string | null
  created_at: Date
  updated_at: Date
  published_at?: Date
  short_title?: string
  title: string
  seo_title?: string
  summary?: string
  seo_description?: string
  seo_keywords?: string
  old_slug?: string
  slug?: string
  categories?: string[]
  hit?: number
  show_on_mainpage?: boolean
  location?: number
  old_related_posts_ids?: string[]
  topics?: string[]
  editor_id?: string | null
  source_id?: string | null
  show_text_on_image?: {
    post_headline?: boolean
  }
  image_description?: string | null
  commentable?: boolean
  redirect_link?: string | null
  show_ads?: boolean
  status?: number
  sort_date?: Date
  is_seo_news?: boolean
  attachments?: {
    images?: {
      post_cover?: {
        attachment_id?: string
        public_path?: string
      }
    }
  }
  content?: {
    text?: string
  }
}

// MongoDB Category structure (referenced in categories array)
export interface MongoCategory {
  _id: ObjectId
  name: string
  slug?: string
  description?: string
  created_at?: Date
  updated_at?: Date
}

// MongoDB Topic structure (referenced in topics array)
export interface MongoTopic {
  _id: ObjectId
  name: string
  slug?: string
  description?: string
  created_at?: Date
  updated_at?: Date
}

// MongoDB Source structure (referenced in source_id)
export interface MongoSource {
  _id: ObjectId
  name: string
  url?: string
  description?: string
  created_at?: Date
  updated_at?: Date
}

// Migration tracking
export interface MigrationJob {
  id: string
  source_db: string
  target_channel_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  total_records: number
  processed_records: number
  failed_records: number
  started_at?: Date
  completed_at?: Date
  error_message?: string
  last_processed_id?: string
}

// Transformation result
export interface TransformationResult {
  success: boolean
  data?: {
    title: string
    content: string
    summary?: string
    published_at?: Date
    channel_id: string
    source_metadata: Record<string, any>
  }
  error?: string
  skipped?: boolean
  skip_reason?: string
}

// Migration result
export interface MigrationResult {
  success: boolean
  processed: number
  inserted: number
  skipped: number
  errors: number
  duration: number
  error_details: Array<{
    post_id: string
    error: string
  }>
} 