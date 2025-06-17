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
export interface NewsArticleVector {
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
  original_mongo_id?: string
}

// Vector search result
interface VectorSearchResult {
  id: string
  score: number
  payload: {
    channel_id: string
    title: string
    content: string
    content_preview: string
    published_at: string
    categories: string[]
    topics: string[]
    political_score?: number
    event_category?: string
    original_mongo_id?: string
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
  private openai?: OpenAI
  private config: VectorConfig

  constructor(config?: Partial<VectorConfig>) {
    // Default configuration
    this.config = {
      qdrantUrl: config?.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: config?.qdrantApiKey || process.env.QDRANT_API_KEY,
      openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY || '',
      collectionName: config?.collectionName || 'news_embeddings',
      vectorSize: config?.vectorSize || 1536
    }
    
    // Initialize Qdrant client
    this.qdrant = new QdrantClient({
      url: this.config.qdrantUrl,
      apiKey: this.config.qdrantApiKey,
    })

    // Initialize OpenAI client only if API key is available
    if (this.config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: this.config.openaiApiKey,
      })
    }
  }

  /**
   * Simple text-based embedding generation (without OpenAI)
   */
  private generateSimpleEmbedding(text: string): number[] {
    // Create a simple hash-based embedding with 1536 dimensions
    const words = text.toLowerCase().match(/\w+/g) || []
    const embedding = new Array(this.config.vectorSize).fill(0)
    
    // Use word frequency and position for embedding
    const wordFreq: Record<string, number> = {}
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })
    
    // Convert words to numerical features across all dimensions
    Object.entries(wordFreq).forEach(([word, freq]) => {
      const hash = this.simpleHash(word)
      // Distribute features across multiple dimensions
      for (let i = 0; i < 5; i++) {
        const position = (hash + i * 307) % this.config.vectorSize // Use prime number for distribution
        embedding[position] += (freq / words.length) * Math.cos(i * 0.1)
      }
    })
    
    // Add text length and character diversity features
    const textLength = text.length
    const uniqueChars = new Set(text.toLowerCase()).size
    
    // Fill remaining dimensions with text statistics
    for (let i = 0; i < Math.min(100, this.config.vectorSize); i++) {
      if (embedding[i] === 0) {
        embedding[i] = (textLength * uniqueChars * Math.sin(i * 0.01)) / 10000
      }
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude)
    }
    
    return embedding
  }

  /**
   * Simple hash function for word mapping
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Generate embeddings for text content
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use OpenAI if available, otherwise use simple embedding
      if (this.openai) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
          encoding_format: 'float',
        })
        return response.data[0].embedding
      } else {
        // Use simple embedding method
        return this.generateSimpleEmbedding(text)
      }
    } catch (error) {
      console.warn('❌ OpenAI embedding failed, using simple embedding:', error)
      // Fallback to simple embedding
      return this.generateSimpleEmbedding(text)
    }
  }

  /**
   * Initialize vector collection if it doesn't exist
   */
  async initializeCollection(): Promise<void> {
    try {
      console.log(`🔍 Checking collection: ${this.config.collectionName}`)
      
      // Check if collection exists
      const collections = await this.qdrant.getCollections()
      const collectionExists = collections.collections.some(
        col => col.name === this.config.collectionName
      )

      if (!collectionExists) {
        console.log(`🆕 Creating collection: ${this.config.collectionName}`)
        
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

        console.log(`🔍 Creating indexes for collection: ${this.config.collectionName}`)
        
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

        await this.qdrant.createPayloadIndex(this.config.collectionName, {
          field_name: 'event_category',
          field_schema: 'keyword',
        })

        await this.qdrant.createPayloadIndex(this.config.collectionName, {
          field_name: 'topics',
          field_schema: 'keyword',
        })

        await this.qdrant.createPayloadIndex(this.config.collectionName, {
          field_name: 'political_score',
          field_schema: 'float',
        })

        console.log(`✅ Collection ${this.config.collectionName} created successfully`)
      } else {
        console.log(`✅ Collection ${this.config.collectionName} already exists`)
        
        // Get collection info
        const collectionInfo = await this.qdrant.getCollection(this.config.collectionName)
        const vectorSize = collectionInfo.config?.params?.vectors?.size || 'unknown'
        console.log(`📊 Collection stats: ${collectionInfo.points_count} points, vector size: ${vectorSize}`)
      }
    } catch (error) {
      console.error('❌ Failed to initialize collection:', error)
      throw error
    }
  }

  /**
   * Store news article in vector database
   */
  async storeArticle(article: NewsArticleVector): Promise<void> {
    try {
      console.log(`📝 Storing article vector: ${article.title.substring(0, 50)}...`)
      
      // Prepare content for embedding (title + full content for better embeddings)
      const contentForEmbedding = `${article.title}\n\n${article.content}`
      
      // Generate embedding
      const embedding = await this.generateEmbedding(contentForEmbedding)
      console.log(`🧮 Generated embedding with ${embedding.length} dimensions`)

      // Prepare payload with full content
      const payload = {
        channel_id: article.channel_id,
        title: article.title,
        content: article.content,
        content_preview: article.content.substring(0, 500),
        published_at: article.published_at.toISOString(),
        categories: article.categories,
        topics: article.topics,
        political_score: article.political_score,
        event_category: article.event_category,
        source_url: article.source_url,
        original_mongo_id: article.original_mongo_id,
      }

      // Store in Qdrant
      const result = await this.qdrant.upsert(this.config.collectionName, {
        wait: true,
        points: [
          {
            id: article.id,
            vector: embedding,
            payload,
          },
        ],
      })

      console.log(`✅ Successfully stored article vector: ${article.id}`)
      console.log(`   Content length: ${article.content.length} characters`)
    } catch (error) {
      console.error(`❌ Failed to store article vector: ${article.title}`, error)
      throw error
    }
  }

  /**
   * Store multiple articles in batch
   */
  async storeArticlesBatch(articles: NewsArticleVector[]): Promise<void> {
    if (articles.length === 0) {
      console.log('📦 Empty batch, skipping vector storage')
      return
    }

    try {
      console.log(`📦 Storing batch of ${articles.length} article vectors...`)
      
      const points = []
      
      for (const article of articles) {
        try {
          // Prepare content for embedding (title + full content)
          const contentForEmbedding = `${article.title}\n\n${article.content}`
          
          // Generate embedding
          const embedding = await this.generateEmbedding(contentForEmbedding)
          
          // Prepare payload with full content
          const payload = {
            channel_id: article.channel_id,
            title: article.title,
            content: article.content,
            content_preview: article.content.substring(0, 500),
            published_at: article.published_at.toISOString(),
            categories: article.categories,
            topics: article.topics,
            political_score: article.political_score,
            event_category: article.event_category,
            source_url: article.source_url,
            original_mongo_id: article.original_mongo_id,
          }

          points.push({
            id: article.id,
            vector: embedding,
            payload,
          })
          
          console.log(`🧮 Processed article: ${article.title.substring(0, 30)}... (${article.content.length} chars, ${embedding.length}D)`)
        } catch (articleError) {
          console.error(`❌ Failed to process article for vector: ${article.title}`, articleError)
          // Continue with other articles
        }
      }

      if (points.length > 0) {
        console.log(`💾 Upserting ${points.length} points to ${this.config.collectionName}`)
        
        const result = await this.qdrant.upsert(this.config.collectionName, {
          wait: true,
          points,
        })

        console.log(`✅ Successfully stored batch: ${points.length} vectors`)
        
        // Log total content statistics
        const totalContentLength = articles.reduce((sum, article) => sum + article.content.length, 0)
        const avgContentLength = Math.round(totalContentLength / articles.length)
        console.log(`📊 Batch stats: ${totalContentLength} total chars, ${avgContentLength} avg chars per article`)
      } else {
        console.warn('⚠️ No valid points to store in this batch')
      }
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

      // Prepare filter conditions in Qdrant format
      let filter: any = undefined
      
      if (options.filter) {
        const conditions: any[] = []
        
        if (options.filter.channel_id) {
          conditions.push({ key: 'channel_id', match: { value: options.filter.channel_id } })
        }
        
        if (options.filter.categories && options.filter.categories.length > 0) {
          conditions.push({ key: 'categories', match: { any: options.filter.categories } })
        }
        
        if (options.filter.topics && options.filter.topics.length > 0) {
          conditions.push({ key: 'topics', match: { any: options.filter.topics } })
        }
        
        if (options.filter.date_range) {
          conditions.push({
            key: 'published_at',
            range: {
              gte: options.filter.date_range.start.toISOString(),
              lte: options.filter.date_range.end.toISOString(),
            },
          })
        }
        
        if (options.filter.political_score_range) {
          conditions.push({
            key: 'political_score',
            range: {
              gte: options.filter.political_score_range.min,
              lte: options.filter.political_score_range.max,
            },
          })
        }
        
        if (conditions.length > 0) {
          filter = { must: conditions }
        }
      }

      // Perform vector search
      const searchResult = await this.qdrant.search(this.config.collectionName, {
        vector: queryEmbedding,
        limit: options.limit || 10,
        score_threshold: options.threshold || 0.7,
        filter: filter,
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
        indexed_points: info.indexed_vectors_count || 0,
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
  // Use default configuration - no OpenAI API key required
  return new VectorService()
}

// Export types
export type {
  VectorConfig, VectorSearchOptions, VectorSearchResult
}

