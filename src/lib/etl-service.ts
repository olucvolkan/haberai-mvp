import { MigrationResult, MongoPost } from '@/types/mongodb'
import { randomUUID } from 'crypto'
import dotenv from 'dotenv'
import { MongoDBService, cleanHtmlContent, validatePostContent } from './mongodb'
import { NewsArticleVector, VectorService } from './vector-service'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Vector-only ETL Service for direct MongoDB to Vector DB migration
export class ETLService {
  private mongoService: MongoDBService
  private vectorService: VectorService
  private batchSize: number

  constructor(
    mongoService: MongoDBService, 
    batchSize: number = 500,
    vectorService: VectorService
  ) {
    this.mongoService = mongoService
    this.vectorService = vectorService
    this.batchSize = batchSize
  }

  /**
   * Generate a simple random UUID for vector storage
   */
  private generateRandomUUID(): string {
    return randomUUID()
  }

  /**
   * Transform MongoDB post to Vector format
   */
  transformPostToVector(mongoPost: MongoPost): { success: boolean; data?: NewsArticleVector; error?: string; skipped?: boolean; skip_reason?: string } {
    try {
      console.log(`🔍 Transforming post: ${mongoPost._id}`)

      // Validate post content
      const validation = validatePostContent(mongoPost)
      if (!validation.isValid) {
        console.log(`❌ Validation failed: ${validation.issues.join(', ')}`)
        return {
          success: false,
          skipped: true,
          skip_reason: `Validation failed: ${validation.issues.join(', ')}`
        }
      }

      // Extract content from various possible fields
      let rawContent = ''
      if (mongoPost.content?.text) {
        rawContent = mongoPost.content.text
      } else if ((mongoPost as any).text) {
        rawContent = (mongoPost as any).text
      } else if ((mongoPost as any).body) {
        rawContent = (mongoPost as any).body
      } else if (mongoPost.summary) {
        rawContent = mongoPost.summary
      } else if (mongoPost.seo_description) {
        rawContent = mongoPost.seo_description
      }

      // Clean HTML content
      const cleanContent = cleanHtmlContent(rawContent)
      
      if (!cleanContent || cleanContent.trim().length < 5) {
        return {
          success: false,
          skipped: true,
          skip_reason: `Content too short after cleaning: ${cleanContent.length} characters`
        }
      }

      // Create vector article data
      const vectorArticle: NewsArticleVector = {
        id: this.generateRandomUUID(), // Simple random UUID
        channel_id: 'mongodb-import', // Default channel for vector storage
        title: mongoPost.title,
        content: cleanContent,
        published_at: mongoPost.published_at || mongoPost.created_at,
        categories: mongoPost.categories || [],
        topics: mongoPost.topics || [],
        political_score: undefined, // Will be calculated by vector service
        event_category: this.categorizeEvent(mongoPost.title, cleanContent),
        source_url: mongoPost.slug ? `/${mongoPost.slug}` : undefined,
        original_mongo_id: mongoPost._id.toString(), // Keep original MongoDB ID for reference
      }

      return {
        success: true,
        data: vectorArticle
      }
    } catch (error) {
      return {
        success: false,
        error: `Transformation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Categorize event type based on title and content
   */
  private categorizeEvent(title: string, content: string): string {
    const text = `${title} ${content}`.toLowerCase()
    
    // Political events
    if (text.match(/\b(seçim|parti|milletvekili|başkan|hükümet|meclis|politika)\b/)) {
      return 'politics'
    }
    
    // Economic events
    if (text.match(/\b(ekonomi|dolar|euro|borsa|enflasyon|faiz|tcmb|merkez bankası)\b/)) {
      return 'economy'
    }
    
    // Sports events
    if (text.match(/\b(futbol|basketbol|spor|maç|takım|galatasaray|fenerbahçe|beşiktaş)\b/)) {
      return 'sports'
    }
    
    // Technology events
    if (text.match(/\b(teknoloji|yapay zeka|internet|bilgisayar|telefon|uygulama)\b/)) {
      return 'technology'
    }
    
    // Health events
    if (text.match(/\b(sağlık|hastane|doktor|tedavi|aşı|covid|corona)\b/)) {
      return 'health'
    }
    
    // Default category
    return 'general'
  }

  /**
   * Vector-only migration - directly from MongoDB to Vector DB
   */
  async migrateToVectorOnly(options: {
    limit?: number
    offset?: number
    dateRange?: { start: Date; end: Date }
    dryRun?: boolean
  } = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const result: MigrationResult = {
      success: true,
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: 0,
      duration: 0,
      error_details: []
    }

    try {
      console.log(`🚀 Starting Vector-Only Migration...`)
      console.log(`   Batch Size: ${this.batchSize}`)
      console.log(`   Target: Vector Database Only`)

      // Ensure MongoDB connection
      const isConnected = await this.mongoService.healthCheck()
      if (!isConnected) {
        console.log('🔌 Establishing MongoDB connection...')
        await this.mongoService.connect()
      }

      // Initialize vector collection
      console.log('📦 Initializing vector collection...')
      await this.vectorService.initializeCollection()
      console.log('✅ Vector collection ready')

      // Get total count for progress tracking
      const totalPosts = await this.mongoService.getPostCount(
        options.dateRange?.start,
        options.dateRange?.end
      )
      console.log(`📊 Total posts to process: ${totalPosts}`)

      let currentOffset = options.offset || 0

      // For testing: limit to first 500 records only
      const testLimit = 500
      const effectiveLimit = options.limit ? Math.min(options.limit, testLimit) : testLimit
      
      console.log(`🧪 TEST MODE: Processing only first ${effectiveLimit} records`)

      while (currentOffset < totalPosts && result.processed < effectiveLimit) {
        const remainingLimit = Math.min(this.batchSize, effectiveLimit - result.processed)
        
        console.log(`📄 Processing batch: ${currentOffset + 1}-${currentOffset + remainingLimit} (${remainingLimit} records this batch)`)

        // Fetch batch from MongoDB
        const posts = await this.mongoService.fetchPosts({
          limit: remainingLimit,
          skip: currentOffset,
          fromDate: options.dateRange?.start,
          toDate: options.dateRange?.end
        })

        if (posts.length === 0) {
          console.log('✅ No more posts to process')
          break
        }
    
        console.log(`🔄 Processing ${posts.length} posts...`)

        // Transform posts to vector format
        const vectorArticles: NewsArticleVector[] = []
        
        for (const post of posts) {
          result.processed++

          console.log(`📝 Processing: ${post.title?.substring(0, 50)}... (ID: ${post._id})`)

          // Transform to vector format
          const transformation = this.transformPostToVector(post)
          
          if (transformation.skipped) {
            result.skipped++
            console.log(`⏭️  SKIPPED: ${transformation.skip_reason}`)
            continue
          }

          if (!transformation.success || !transformation.data) {
            result.errors++
            console.log(`❌ ERROR: ${transformation.error}`)
            result.error_details.push({
              post_id: post._id.toString(),
              error: transformation.error || 'Unknown transformation error'
            })
            continue
          }

          console.log(`✅ TRANSFORMED: Ready for vector storage`)
          vectorArticles.push(transformation.data)
        }

        // Write batch to vector database
        if (!options.dryRun && vectorArticles.length > 0) {
          try {
            console.log(`🔮 Writing ${vectorArticles.length} articles to Vector Database...`)
            
            await this.vectorService.storeArticlesBatch(vectorArticles)
            
            result.inserted += vectorArticles.length
            console.log(`✅ Successfully stored ${vectorArticles.length} vectors`)

          } catch (error) {
            console.error('❌ Vector storage error:', error)
            result.errors += vectorArticles.length
            result.error_details.push({
              post_id: 'batch',
              error: error instanceof Error ? error.message : 'Unknown vector storage error'
            })
          }
        } else if (options.dryRun) {
          console.log(`🧪 DRY RUN: Would store ${vectorArticles.length} vectors`)
          result.inserted += vectorArticles.length
        }

        // Update offset for next batch
        currentOffset += remainingLimit

        // Progress update
        console.log(`📊 Progress: ${result.processed}/${effectiveLimit} processed, ${result.inserted} stored, ${result.skipped} skipped, ${result.errors} errors`)

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Final statistics
      const endTime = Date.now()
      result.duration = Math.round((endTime - startTime) / 1000)
      
      console.log('')
      console.log('🎯 VECTOR MIGRATION COMPLETED!')
      console.log('═══════════════════════════════════════════')
      console.log(`✅ Results:`)
      console.log(`   • Total processed: ${result.processed}`)
      console.log(`   • Vectors stored: ${result.inserted}`)
      console.log(`   • Records skipped: ${result.skipped}`)
      console.log(`   • Errors: ${result.errors}`)
      console.log(`   • Duration: ${result.duration}s`)
      console.log(`   • Speed: ${Math.round(result.processed / result.duration)} records/sec`)

      // Get final vector database stats
      try {
        const finalStats = await this.vectorService.getCollectionStats()
        console.log(``)
        console.log(`📊 Vector Database Final Stats:`)
        console.log(`   • Total vectors: ${finalStats.total_points}`)
        console.log(`   • Indexed vectors: ${finalStats.indexed_points}`)
        console.log(`   • Status: ${finalStats.status}`)
      } catch (statsError) {
        console.log(`   • Vector stats: Unable to retrieve`)
      }

      return result

    } catch (error) {
      console.error('💥 Migration failed:', error)
      result.success = false
      result.duration = Math.round((Date.now() - startTime) / 1000)
      throw error
    }
  }

  /**
   * Get migration statistics
   */
  async getVectorMigrationStats(): Promise<{
    total_vectors: number
    indexed_vectors: number
    collection_status: string
  }> {
    try {
      const stats = await this.vectorService.getCollectionStats()
      return {
        total_vectors: stats.total_points,
        indexed_vectors: stats.indexed_points,
        collection_status: stats.status
      }
    } catch (error) {
      console.error('Error getting vector migration stats:', error)
      throw error
    }
  }
} 