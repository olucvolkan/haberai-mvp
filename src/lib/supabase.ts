import {
  ChannelProfile,
  CreateChannelRequest,
  EventTemplate,
  GeneratedContent,
  NewsArticle,
  NewsChannel
} from '@/types/database'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// News Channels CRUD operations
export const newsChannelsApi = {
  // Get all channels
  async getAll(): Promise<NewsChannel[]> {
    const { data, error } = await supabase
      .from('news_channels')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Get channel by ID
  async getById(id: string): Promise<NewsChannel | null> {
    const { data, error } = await supabase
      .from('news_channels')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Get channel with profile
  async getWithProfile(id: string) {
    const { data, error } = await supabase
      .from('news_channels')
      .select(`
        *,
        profile:channel_profiles(*)
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Create new channel
  async create(channel: CreateChannelRequest): Promise<NewsChannel> {
    const { data, error } = await supabase
      .from('news_channels')
      .insert([channel])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update channel
  async update(id: string, updates: Partial<NewsChannel>): Promise<NewsChannel> {
    const { data, error } = await supabase
      .from('news_channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Delete channel
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('news_channels')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Channel Profiles operations
export const channelProfilesApi = {
  // Get profile by channel ID
  async getByChannelId(channelId: string): Promise<ChannelProfile | null> {
    const { data, error } = await supabase
      .from('channel_profiles')
      .select('*')
      .eq('channel_id', channelId)
      .single()
    
    if (error) throw error
    return data
  },

  // Create or update profile
  async upsert(profile: Omit<ChannelProfile, 'id' | 'created_at' | 'updated_at'>): Promise<ChannelProfile> {
    const { data, error } = await supabase
      .from('channel_profiles')
      .upsert([profile])
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// News Articles operations
export const newsArticlesApi = {
  // Get articles by channel ID
  async getByChannelId(channelId: string, limit = 50): Promise<NewsArticle[]> {
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .eq('channel_id', channelId)
      .order('published_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  },

  // Create article
  async create(article: Omit<NewsArticle, 'id' | 'created_at' | 'updated_at' | 'migrated_at'>): Promise<NewsArticle> {
    const { data, error } = await supabase
      .from('news_articles')
      .insert([article])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update article analysis status
  async updateAnalysisStatus(id: string, analysisCompleted: boolean, vectorId?: string): Promise<NewsArticle> {
    const updates: any = { analysis_completed: analysisCompleted }
    if (vectorId) updates.vector_id = vectorId

    const { data, error } = await supabase
      .from('news_articles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// Event Templates operations
export const eventTemplatesApi = {
  // Get templates by channel ID and category
  async getByChannelAndCategory(channelId: string, category?: string): Promise<EventTemplate[]> {
    let query = supabase
      .from('event_templates')
      .select('*')
      .eq('channel_id', channelId)
      .order('effectiveness_score', { ascending: false })

    if (category) {
      query = query.eq('event_category', category)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  // Create template
  async create(template: Omit<EventTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<EventTemplate> {
    const { data, error } = await supabase
      .from('event_templates')
      .insert([template])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update usage count
  async incrementUsage(id: string): Promise<void> {
    const { error } = await supabase
      .rpc('increment_template_usage', { template_id: id })
    
    if (error) throw error
  }
}

// Generated Content operations
export const generatedContentApi = {
  // Get generated content by channel ID
  async getByChannelId(channelId: string, limit = 20): Promise<GeneratedContent[]> {
    const { data, error } = await supabase
      .from('generated_content')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  },

  // Create generated content
  async create(content: Omit<GeneratedContent, 'id' | 'created_at' | 'updated_at'>): Promise<GeneratedContent> {
    const { data, error } = await supabase
      .from('generated_content')
      .insert([content])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update approval status
  async updateApproval(id: string, approved: boolean, feedback?: string): Promise<GeneratedContent> {
    const { data, error } = await supabase
      .from('generated_content')
      .update({ 
        human_approved: approved,
        feedback: feedback 
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Get generation history
  async getHistory(limit = 50): Promise<GeneratedContent[]> {
    const { data, error } = await supabase
      .from('generated_content')
      .select(`
        *,
        channel:news_channels(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  }
}

// Utility functions
export const supabaseUtils = {
  // Check if channel exists
  async channelExists(name: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('news_channels')
      .select('id')
      .eq('name', name)
      .single()
    
    return !error && !!data
  }
} 