import { MongoCategory, MongoPost, MongoSource, MongoTopic } from '@/types/mongodb'
import { Collection, Db, MongoClient, ObjectId } from 'mongodb'

// MongoDB connection configuration
export class MongoDBService {
  private client: MongoClient | null = null
  private db: Db | null = null
  private connectionString: string
  private databaseName: string

  constructor(connectionString: string, databaseName: string) {
    this.connectionString = connectionString
    this.databaseName = databaseName
  }

  // Connect to MongoDB
  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(this.connectionString, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })
      
      await this.client.connect()
      this.db = this.client.db(this.databaseName)
      console.log('MongoDB connected successfully')
    } catch (error) {
      console.error('MongoDB connection error:', error)
      throw error
    }
  }

  // Disconnect from MongoDB
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.db = null
      console.log('MongoDB disconnected')
    }
  }

  // Get posts collection
  private getPostsCollection(): Collection<MongoPost> {
    if (!this.db) throw new Error('Database not connected')
    return this.db.collection<MongoPost>('posts')
  }

  // Get categories collection
  private getCategoriesCollection(): Collection<MongoCategory> {
    if (!this.db) throw new Error('Database not connected')
    return this.db.collection<MongoCategory>('categories')
  }

  // Get topics collection
  private getTopicsCollection(): Collection<MongoTopic> {
    if (!this.db) throw new Error('Database not connected')
    return this.db.collection<MongoTopic>('topics')
  }

  // Get sources collection
  private getSourcesCollection(): Collection<MongoSource> {
    if (!this.db) throw new Error('Database not connected')
    return this.db.collection<MongoSource>('sources')
  }

  // Fetch posts with pagination
  async fetchPosts(options: {
    limit?: number
    skip?: number
    fromDate?: Date
    toDate?: Date
    status?: number
    lastId?: string
  } = {}): Promise<MongoPost[]> {
    const {
      limit = 100,
      skip = 0,
      fromDate,
      toDate,
      status = 1, // Active posts only
      lastId
    } = options

    const collection = this.getPostsCollection()
    const query: any = { status }

    // Date range filter
    if (fromDate || toDate) {
      query.published_at = {}
      if (fromDate) query.published_at.$gte = fromDate
      if (toDate) query.published_at.$lte = toDate
    }

    // Cursor-based pagination
    if (lastId) {
      query._id = { $gt: lastId }
    }

    try {
      const posts = await collection
        .find(query)
        .sort({ _id: 1 }) // For consistent pagination
        .skip(skip)
        .limit(limit)
        .toArray()

      return posts
    } catch (error) {
      console.error('Error fetching posts:', error)
      throw error
    }
  }

  // Get total post count
  async getPostCount(fromDate?: Date, toDate?: Date): Promise<number> {
    // Ensure database connection
    if (!this.db) {
      const isConnected = await this.healthCheck()
      if (!isConnected) {
        await this.connect()
      }
    }

    const collection = this.getPostsCollection()
    const query: any = { status: 1 }

    if (fromDate || toDate) {
      query.published_at = {}
      if (fromDate) query.published_at.$gte = fromDate
      if (toDate) query.published_at.$lte = toDate
    }

    return await collection.countDocuments(query)
  }

  // Fetch categories by IDs
  async fetchCategoriesByIds(categoryIds: string[]): Promise<MongoCategory[]> {
    if (categoryIds.length === 0) return []

    const collection = this.getCategoriesCollection()
    
    try {
      // Convert string IDs to ObjectIds using safe helper
      const objectIds = toObjectIds(categoryIds)
      if (objectIds.length === 0) {
        console.warn('No valid ObjectIds found in category IDs')
        return []
      }

      const categories = await collection
        .find({ _id: { $in: objectIds } })
        .toArray()

      return categories
    } catch (error) {
      console.error('Error fetching categories:', error)
      throw error
    }
  }

  // Fetch topics by IDs
  async fetchTopicsByIds(topicIds: string[]): Promise<MongoTopic[]> {
    if (topicIds.length === 0) return []

    const collection = this.getTopicsCollection()
    
    try {
      // Convert string IDs to ObjectIds using safe helper
      const objectIds = toObjectIds(topicIds)
      if (objectIds.length === 0) {
        console.warn('No valid ObjectIds found in topic IDs')
        return []
      }

      const topics = await collection
        .find({ _id: { $in: objectIds } })
        .toArray()

      return topics
    } catch (error) {
      console.error('Error fetching topics:', error)
      throw error
    }
  }

  // Fetch source by ID
  async fetchSourceById(sourceId: string): Promise<MongoSource | null> {
    if (!sourceId) return null

    const collection = this.getSourcesCollection()
    
    try {
      // Convert string ID to ObjectId using safe helper
      const objectId = toObjectId(sourceId)
      if (!objectId) {
        console.warn(`Invalid source ObjectId: ${sourceId}`)
        return null
      }

      const source = await collection.findOne({ _id: objectId })
      return source
    } catch (error) {
      console.error('Error fetching source:', error)
      throw error
    }
  }

  // Get latest post ID for resuming migrations
  async getLatestPostId(): Promise<string | null> {
    const collection = this.getPostsCollection()
    
    try {
      const latestPost = await collection
        .findOne({}, { sort: { _id: -1 } })

      return latestPost?._id.toString() || null
    } catch (error) {
      console.error('Error fetching latest post ID:', error)
      throw error
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false
      await this.db.admin().ping()
      return true
    } catch (error) {
      console.error('MongoDB health check failed:', error)
      return false
    }
  }
}

// Singleton instance creator
export function createMongoDBService(): MongoDBService {
  const connectionString = process.env.MONGODB_CONNECTION_STRING
  const databaseName = process.env.MONGODB_DATABASE_NAME || 'haberdb'

  if (!connectionString) {
    throw new Error('MONGODB_CONNECTION_STRING environment variable is required')
  }

  return new MongoDBService(connectionString, databaseName)
}

// HTML content cleaner utility
export function cleanHtmlContent(html: string): string {
  if (!html) return ''
  
  // Remove HTML tags but preserve structure for better readability
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

// Safe ObjectId conversion utilities
export function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id)
  } catch (error) {
    console.warn(`Invalid ObjectId: ${id}`)
    return null
  }
}

export function toObjectIds(ids: string[]): ObjectId[] {
  return ids.map(toObjectId).filter((id): id is ObjectId => id !== null)
}

// Content quality validator
export function validatePostContent(post: MongoPost): { 
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check required fields
  if (!post.title || post.title.trim().length === 0) {
    issues.push('Missing or empty title')
  }

  // Try to find content in various possible fields
  let contentText = ''
  if (post.content?.text) {
    contentText = post.content.text
  } else if ((post as any).text) {
    contentText = (post as any).text
  } else if ((post as any).body) {
    contentText = (post as any).body
  } else if (post.summary) {
    contentText = post.summary
  } else if (post.seo_description) {
    contentText = post.seo_description
  }

  if (!contentText || contentText.trim().length === 0) {
    issues.push('Missing or empty content in all possible fields')
  }

  // Check minimum content length (very relaxed for testing)
  const cleanContent = cleanHtmlContent(contentText || '')
  if (cleanContent.length < 5) {
    issues.push(`Content too short (${cleanContent.length} chars, minimum 5 characters)`)
  }

  // Check for spam indicators
  if (post.title && post.title.length > 500) {
    issues.push('Title too long (maximum 500 characters)')
  }

  // Relaxed status check - allow more statuses for testing
  if (post.status !== undefined && post.status !== 1 && post.status !== 0) {
    issues.push(`Post status is ${post.status} (unusual status)`)
  }

  return {
    isValid: issues.length === 0,
    issues
  }
} 