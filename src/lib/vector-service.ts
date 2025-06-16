import { QdrantClient } from '@qdrant/js-client-rest'
import OpenAI from 'openai'

// Vector database configuration
interface VectorConfig {
  qdrantUrl: string
  qdrantApiKey?: string
  openaiApiKey: string
  collectionName: string
  vectorSize: number
}

// News article for vector storage
interface NewsArticleVector {
  id: string
  channel_id: string
  title: string
  content: string
  published_at: Date
  categories: string[]
  topics: string[]
  political_score?: number
  event_category?: string
  source_url?: string
}

// Vector search result
interface VectorSearchResult {
  id: string
  score: number
  payload: {
    channel_id: string
    title: string
    content_preview: string
    published_at: string
    categories: string[]
    topics: string[]
    political_score?: number
    event_category?: string
  }
}

// Vector search options
interface VectorSearchOptions {
  limit?: number
  threshold?: number
  filter?: {
    channel_id?: string
    categories?: string[]
    topics?: string[]
    date_range?: {
      start: Date
      end: Date
    }
    political_score_range?: {
      min: number
      max: number
    }
  }
}

export class VectorService {
  private qdrant: QdrantClient
  private openai: OpenAI
  private config: VectorConfig

  constructor(config: VectorConfig) {
    this.config = config
    
    // Initialize Qdrant client
    this.qdrant = new QdrantClient({
      url: config.qdrantUrl,
      apiKey: config.qdrantApiKey,
    })

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    })
  }

  /**
   * Initialize vector collection if it doesn't exist
   */
  async initializeCollection(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.qdrant.getCollections()
      const collectionExists = collections.collections.some(
        col => col.name === this.config.collectionName
      )

      if (!collectionExists) {
        console.log(`Creating collection: ${this.config.collectionName}`)
        
        await this.qdrant.createCollection(this.config.collectionName, {
          vectors: {
            size: this.config.vectorSize,
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        })

        // Create indexes for better search performance
        await this.qdrant.createPayloadIndex(this.config.collectionName, {
          field_name: 'channel_id',
          field_schema: 'keyword',
        })

        await this.qdrant.createPayloadIndex(this.config.collectionName, {
          field_name: 'categories',
          field_schema: 'keyword',
        })

        await this.qdrant.createPayloadIndex(this.config.collectionName, {
          field_name: 'published_at',
          field_schema: 'datetime',
        })

        console.log(`✅ Collection ${this.config.collectionName} created successfully`)
      } else {
        console.log(`✅ Collection ${this.config.collectionName} already exists`)
      }
    } catch (error) {
      console.error('❌ Failed to initialize collection:', error)
      throw error
    }
  }

  /**
   * Generate embeddings for text content
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error)
      throw error
    }
  }

  /**
   * Store news article in vector database
   */
  async storeArticle(article: NewsArticleVector): Promise<void> {
    try {
      // Prepare content for embedding (title + content preview)
      const contentForEmbedding = `${article.title}\n\n${article.content.substring(0, 1000)}`
      
      // Generate embedding
      const embedding = await this.generateEmbedding(contentForEmbedding)

      // Prepare payload
      const payload = {
        channel_id: article.channel_id,
        title: article.title,
        content_preview: article.content.substring(0, 500),
        published_at: article.published_at.toISOString(),
        categories: article.categories,
        topics: article.topics,
        political_score: article.political_score,
        event_category: article.event_category,
        source_url: article.source_url,
      }

      // Store in Qdrant
      await this.qdrant.upsert(this.config.collectionName, {
        wait: true,
        points: [
          {
            id: article.id,
            vector: embedding,
            payload,
          },
        ],
      })

      console.log(`✅ Stored article: ${article.id}`)
    } catch (error) {
      console.error(`❌ Failed to store article ${article.id}:`, error)
      throw error
    }
  }

  /**
   * Store multiple articles in batch
   */
  async storeArticlesBatch(articles: NewsArticleVector[]): Promise<void> {
    try {
      console.log(`📦 Processing batch of ${articles.length} articles...`)

      // Generate embeddings for all articles
      const embeddings = await Promise.all(
        articles.map(async (article) => {
          const contentForEmbedding = `${article.title}\n\n${article.content.substring(0, 1000)}`
          return await this.generateEmbedding(contentForEmbedding)
        })
      )

      // Prepare points for batch insert
      const points = articles.map((article, index) => ({
        id: article.id,
        vector: embeddings[index],
        payload: {
          channel_id: article.channel_id,
          title: article.title,
          content_preview: article.content.substring(0, 500),
          published_at: article.published_at.toISOString(),
          categories: article.categories,
          topics: article.topics,
          political_score: article.political_score,
          event_category: article.event_category,
          source_url: article.source_url,
        },
      }))

      // Batch insert to Qdrant
      await this.qdrant.upsert(this.config.collectionName, {
        wait: true,
        points,
      })

      console.log(`✅ Stored ${articles.length} articles in batch`)
    } catch (error) {
      console.error('❌ Failed to store articles batch:', error)
      throw error
    }
  }

  /**
   * Search for similar articles
   */
  async searchSimilar(
    query: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query)

      // Prepare filter conditions
      const filter: any = {}
      
      if (options.filter) {
        if (options.filter.channel_id) {
          filter.channel_id = { match: { value: options.filter.channel_id } }
        }
        
        if (options.filter.categories && options.filter.categories.length > 0) {
          filter.categories = { match: { any: options.filter.categories } }
        }
        
        if (options.filter.topics && options.filter.topics.length > 0) {
          filter.topics = { match: { any: options.filter.topics } }
        }
        
        if (options.filter.date_range) {
          filter.published_at = {
            range: {
              gte: options.filter.date_range.start.toISOString(),
              lte: options.filter.date_range.end.toISOString(),
            },
          }
        }
        
        if (options.filter.political_score_range) {
          filter.political_score = {
            range: {
              gte: options.filter.political_score_range.min,
              lte: options.filter.political_score_range.max,
            },
          }
        }
      }

      // Perform vector search
      const searchResult = await this.qdrant.search(this.config.collectionName, {
        vector: queryEmbedding,
        limit: options.limit || 10,
        score_threshold: options.threshold || 0.7,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        with_payload: true,
      })

      // Transform results
      return searchResult.map(result => ({
        id: result.id as string,
        score: result.score,
        payload: result.payload as VectorSearchResult['payload'],
      }))
    } catch (error) {
      console.error('❌ Failed to search similar articles:', error)
      throw error
    }
  }

  /**
   * Find articles by channel and event category
   */
  async findByChannelAndEvent(
    channelId: string,
    eventCategory: string,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    try {
      const searchResult = await this.qdrant.scroll(this.config.collectionName, {
        filter: {
          must: [
            { key: 'channel_id', match: { value: channelId } },
            { key: 'event_category', match: { value: eventCategory } },
          ],
        },
        limit,
        with_payload: true,
      })

      return searchResult.points.map(point => ({
        id: point.id as string,
        score: 1.0, // No similarity score for exact match
        payload: point.payload as VectorSearchResult['payload'],
      }))
    } catch (error) {
      console.error('❌ Failed to find articles by channel and event:', error)
      throw error
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<{
    total_points: number
    indexed_points: number
    status: string
  }> {
    try {
      const info = await this.qdrant.getCollection(this.config.collectionName)
      return {
        total_points: info.points_count || 0,
        indexed_points: info.indexed_points_count || 0,
        status: info.status,
      }
    } catch (error) {
      console.error('❌ Failed to get collection stats:', error)
      throw error
    }
  }

  /**
   * Delete articles by channel
   */
  async deleteByChannel(channelId: string): Promise<void> {
    try {
      await this.qdrant.delete(this.config.collectionName, {
        filter: {
          must: [{ key: 'channel_id', match: { value: channelId } }],
        },
      })
      
      console.log(`✅ Deleted all articles for channel: ${channelId}`)
    } catch (error) {
      console.error(`❌ Failed to delete articles for channel ${channelId}:`, error)
      throw error
    }
  }

  /**
   * Health check for vector database
   */
  async healthCheck(): Promise<boolean> {
    try {
      const collections = await this.qdrant.getCollections()
      return collections.collections.length >= 0
    } catch (error) {
      console.error('❌ Vector database health check failed:', error)
      return false
    }
  }
}

// Factory function to create vector service
export function createVectorService(): VectorService {
  const config: VectorConfig = {
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    qdrantApiKey: process.env.QDRANT_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    collectionName: 'news_embeddings',
    vectorSize: 1536, // text-embedding-3-small dimension
  }

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for vector service')
  }

  return new VectorService(config)
}

// Export types
export type {
    NewsArticleVector, VectorConfig, VectorSearchOptions, VectorSearchResult
}
