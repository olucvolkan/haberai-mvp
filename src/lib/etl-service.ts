import type { Database } from '@/types/database'
import { CreateChannelRequest } from '@/types/database'
import { MigrationJob, MigrationResult, MongoPost, TransformationResult } from '@/types/mongodb'
import { createClient } from '@supabase/supabase-js'
import { MongoDBService, cleanHtmlContent, validatePostContent } from './mongodb'
import { newsArticlesApi, newsChannelsApi } from './supabase'
import { NewsArticleVector, VectorService } from './vector-service'

export class ETLService {
  private mongoService: MongoDBService
  private supabase: ReturnType<typeof createClient<Database>>
  private vectorService?: VectorService
  private batchSize: number
  private defaultChannelId: string | null = null

  constructor(
    mongoService: MongoDBService, 
    batchSize: number = 50,
    vectorService?: VectorService
  ) {
    this.mongoService = mongoService
    this.batchSize = batchSize
    this.vectorService = vectorService

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    this.supabase = createClient<Database>(supabaseUrl, supabaseKey)
  }

  // Initialize or get default channel for migration
  async ensureDefaultChannel(channelName = 'MongoDB Import'): Promise<string> {
    if (this.defaultChannelId) return this.defaultChannelId

    try {
      // Check if channel already exists
      const channels = await newsChannelsApi.getAll()
      const existingChannel = channels.find(c => c.name === channelName)
      
      if (existingChannel) {
        this.defaultChannelId = existingChannel.id
        return existingChannel.id
      }

      // Create new channel
      const newChannelRequest: CreateChannelRequest = {
        name: channelName,
        source_db_config: {
          type: 'mongodb',
          database: process.env.MONGODB_DATABASE_NAME,
          collections: ['posts', 'categories', 'topics'],
          migrated_at: new Date().toISOString()
        }
      }

      const newChannel = await newsChannelsApi.create(newChannelRequest)
      this.defaultChannelId = newChannel.id
      
      console.log(`Created default channel: ${channelName} (${newChannel.id})`)
      return newChannel.id
    } catch (error) {
      console.error('Error ensuring default channel:', error)
      throw error
    }
  }

  // Transform MongoDB post to Supabase news article
  transformPost(mongoPost: MongoPost, channelId: string): TransformationResult {
    try {
      // Validate post content first
      const validation = validatePostContent(mongoPost)
      if (!validation.isValid) {
        return {
          success: false,
          skipped: true,
          skip_reason: `Validation failed: ${validation.issues.join(', ')}`
        }
      }

      // Extract and clean content
      const rawContent = mongoPost.content?.text || ''
      const cleanContent = cleanHtmlContent(rawContent)
      
      // Create summary from content if not provided
      let summary = mongoPost.summary || mongoPost.seo_description || ''
      if (!summary && cleanContent) {
        // Create summary from first 200 characters
        summary = cleanContent.substring(0, 200)
        if (cleanContent.length > 200) {
          summary += '...'
        }
      }

      // Build source metadata
      const sourceMetadata = {
        mongo_id: mongoPost._id.toString(),
        integer_id: mongoPost.integer_id,
        old_id: mongoPost.old_id,
        slug: mongoPost.slug,
        old_slug: mongoPost.old_slug,
        categories: mongoPost.categories || [],
        topics: mongoPost.topics || [],
        hit_count: mongoPost.hit || 0,
        seo_keywords: mongoPost.seo_keywords,
        author_id: mongoPost.author_id,
        source_id: mongoPost.source_id,
        location: mongoPost.location,
        is_old_record: mongoPost.is_old_record,
        weight: mongoPost.weight,
        show_on_mainpage: mongoPost.show_on_mainpage,
        attachments: mongoPost.attachments,
        original_raw_content: rawContent,
        migration_timestamp: new Date().toISOString()
      }

      return {
        success: true,
        data: {
          title: mongoPost.title,
          content: cleanContent,
          summary: summary || undefined,
          published_at: mongoPost.published_at,
          channel_id: channelId,
          source_metadata: sourceMetadata
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Transformation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Process a batch of posts
  async processBatch(posts: MongoPost[], channelId: string): Promise<{
    successful: number
    failed: number
    skipped: number
    errors: string[]
  }> {
    const results = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    }

    for (const post of posts) {
      try {
        const transformation = this.transformPost(post, channelId)
        
        if (!transformation.success) {
          if (transformation.skipped) {
            results.skipped++
            console.log(`Skipped post ${post._id}: ${transformation.skip_reason}`)
          } else {
            results.failed++
            results.errors.push(`Post ${post._id}: ${transformation.error}`)
          }
          continue
        }

        if (!transformation.data) {
          results.failed++
          results.errors.push(`Post ${post._id}: No transformation data`)
          continue
        }

        // Create article in Supabase
        const articleData = {
          ...transformation.data,
          analysis_completed: false,
          migrated_at: new Date().toISOString()
        }

        await newsArticlesApi.create(articleData as any)
        results.successful++
        
        console.log(`Successfully migrated post: ${post.title} (${post._id})`)
      } catch (error) {
        results.failed++
        const errorMsg = `Post ${post._id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        results.errors.push(errorMsg)
        console.error('Error processing post:', errorMsg)
      }
    }

    return results
  }

  // Full migration process
  async migrateAllPosts(options: {
    fromDate?: Date
    toDate?: Date
    channelName?: string
    dryRun?: boolean
  } = {}): Promise<MigrationJob> {
    const { fromDate, toDate, channelName = 'MongoDB Import', dryRun = false } = options

    console.log('Starting MongoDB to Supabase migration...')
    console.log('Options:', { fromDate, toDate, channelName, dryRun })

    // Connect to MongoDB
    await this.mongoService.connect()

    try {
      // Ensure channel exists
      const channelId = await this.ensureDefaultChannel(channelName)
      
      // Get total count for progress tracking
      const totalCount = await this.mongoService.getPostCount(fromDate, toDate)
      console.log(`Found ${totalCount} posts to migrate`)

      // Initialize migration job tracking
      const migrationJob: MigrationJob = {
        id: `migration_${Date.now()}`,
        source_db: 'mongodb',
        target_channel_id: channelId,
        status: 'running',
        total_records: totalCount,
        processed_records: 0,
        failed_records: 0,
        started_at: new Date(),
        last_processed_id: undefined
      }

      if (dryRun) {
        console.log('DRY RUN MODE - No data will be inserted')
        migrationJob.status = 'completed'
        return migrationJob
      }

      let hasMore = true
      let lastId: string | undefined
      let totalProcessed = 0
      let totalFailed = 0
      let allErrors: string[] = []

      while (hasMore) {
        try {
          // Fetch batch of posts
          const posts = await this.mongoService.fetchPosts({
            limit: this.batchSize,
            fromDate,
            toDate,
            lastId
          })

          if (posts.length === 0) {
            hasMore = false
            break
          }

          console.log(`Processing batch of ${posts.length} posts...`)

          // Process batch
          const batchResults = await this.processBatch(posts, channelId)
          
          totalProcessed += batchResults.successful + batchResults.skipped
          totalFailed += batchResults.failed
          allErrors.push(...batchResults.errors)

          // Update progress
          migrationJob.processed_records = totalProcessed
          migrationJob.failed_records = totalFailed

          // Update last processed ID for pagination
          const lastPost = posts[posts.length - 1]
          lastId = lastPost._id.toString()
          migrationJob.last_processed_id = lastId

          console.log(`Batch completed: ${batchResults.successful} success, ${batchResults.failed} failed, ${batchResults.skipped} skipped`)
          console.log(`Total progress: ${totalProcessed}/${totalCount} (${Math.round(totalProcessed/totalCount*100)}%)`)

          // Small delay between batches to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          console.error('Error processing batch:', error)
          migrationJob.status = 'failed'
          migrationJob.error_message = error instanceof Error ? error.message : 'Unknown error'
          break
        }
      }

      // Finalize migration job
      migrationJob.completed_at = new Date()
      
      if (migrationJob.status !== 'failed') {
        migrationJob.status = 'completed'
      }

      console.log('Migration completed!')
      console.log(`Total processed: ${totalProcessed}`)
      console.log(`Total failed: ${totalFailed}`)
      
      if (allErrors.length > 0) {
        console.log('Errors encountered:')
        allErrors.slice(0, 10).forEach(error => console.log(`- ${error}`))
        if (allErrors.length > 10) {
          console.log(`... and ${allErrors.length - 10} more errors`)
        }
      }

      return migrationJob

    } finally {
      await this.mongoService.disconnect()
    }
  }

  // Resume migration from last processed ID
  async resumeMigration(lastProcessedId: string, channelId: string): Promise<MigrationJob> {
    console.log(`Resuming migration from ID: ${lastProcessedId}`)
    
    return this.migrateAllPosts({
      channelName: 'MongoDB Import (Resumed)'
    })
  }

  // Get migration statistics
  async getMigrationStats(channelId: string): Promise<{
    total_articles: number
    analyzed_articles: number
    migration_sources: string[]
    latest_migration: Date | null
  }> {
    try {
      const articles = await newsArticlesApi.getByChannelId(channelId, 1000)
      
      const stats = {
        total_articles: articles.length,
        analyzed_articles: articles.filter(a => a.analysis_completed).length,
        migration_sources: [] as string[],
        latest_migration: null as Date | null
      }

      // Extract migration sources and find latest migration
      articles.forEach(article => {
        if (article.migrated_at) {
          const migrationDate = new Date(article.migrated_at)
          if (!stats.latest_migration || migrationDate > stats.latest_migration) {
            stats.latest_migration = migrationDate
          }
        }
      })

      return stats
    } catch (error) {
      console.error('Error getting migration stats:', error)
      throw error
    }
  }

  /**
   * Transform MongoDB post to vector format
   */
  private transformToVector(
    post: MongoPost, 
    channelId: string,
    supabaseArticleId: string
  ): NewsArticleVector | null {
    try {
      // Validate required fields
      if (!post.title || !post.content?.text) {
        return null
      }

      const cleanContent = cleanHtmlContent(post.content.text)
      if (cleanContent.length < 50) {
        return null
      }

      return {
        id: supabaseArticleId, // Use Supabase UUID as vector ID
        channel_id: channelId,
        title: post.title,
        content: cleanContent,
        published_at: post.published_at || post.created_at,
        categories: post.categories || [],
        topics: post.topics || [],
        political_score: undefined, // Will be calculated later
        event_category: this.categorizeEvent(post.title, cleanContent),
        source_url: post.slug ? `/${post.slug}` : undefined,
      }
    } catch (error) {
      console.error('Error transforming post to vector:', error)
      return null
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
   * Migrate posts with vector database integration
   */
  async migrateWithVectors(
    channelId: string,
    options: {
      limit?: number
      offset?: number
      dateRange?: { start: Date; end: Date }
      dryRun?: boolean
      enableVectors?: boolean
    } = {}
  ): Promise<MigrationResult> {
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
      console.log(`🚀 Starting migration with vector integration...`)
      console.log(`   Channel ID: ${channelId}`)
      console.log(`   Batch Size: ${this.batchSize}`)
      console.log(`   Vector Integration: ${options.enableVectors ? 'ENABLED' : 'DISABLED'}`)

      // Initialize vector collection if enabled
      if (options.enableVectors && this.vectorService) {
        console.log('📦 Initializing vector collection...')
        await this.vectorService.initializeCollection()
      }

      // Get total count for progress tracking
      const totalPosts = await this.mongoService.getPostCount(
        options.dateRange?.start,
        options.dateRange?.end
      )
      console.log(`📊 Total posts to process: ${totalPosts}`)

      let currentOffset = options.offset || 0
      let vectorBatch: NewsArticleVector[] = []

      while (currentOffset < totalPosts && (!options.limit || result.processed < options.limit)) {
        const remainingLimit = options.limit ? Math.min(this.batchSize, options.limit - result.processed) : this.batchSize
        
        console.log(`📄 Processing batch: ${currentOffset + 1}-${currentOffset + remainingLimit}`)

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

        // Process batch
        const batchResults: any[] = []
        
        for (const post of posts) {
          result.processed++

          // Transform post
          const transformation = this.transformPost(post, channelId)
          
          if (transformation.skipped) {
            result.skipped++
            continue
          }

          if (!transformation.success || !transformation.data) {
            result.errors++
            result.error_details.push({
              post_id: post._id.toString(),
              error: transformation.error || 'Unknown transformation error'
            })
            continue
          }

          batchResults.push(transformation.data)
        }

        // Insert to Supabase if not dry run
        if (!options.dryRun && batchResults.length > 0) {
          try {
            const { data: insertedArticles, error } = await this.supabase
              .from('news_articles')
              .insert(batchResults)
              .select('id, title, content, published_at, categories, topics')

            if (error) {
              console.error('❌ Supabase insert error:', error)
              result.errors += batchResults.length
              result.error_details.push({
                post_id: 'batch',
                error: error.message
              })
            } else {
              result.inserted += insertedArticles?.length || 0
              console.log(`✅ Inserted ${insertedArticles?.length} articles to Supabase`)

              // Prepare vector batch if enabled
              if (options.enableVectors && this.vectorService && insertedArticles) {
                for (let i = 0; i < insertedArticles.length; i++) {
                  const article = insertedArticles[i]
                  const originalPost = posts[i]
                  
                  const vectorArticle = this.transformToVector(originalPost, channelId, article.id)
                  if (vectorArticle) {
                    vectorBatch.push(vectorArticle)
                  }
                }

                // Process vector batch when it reaches batch size
                if (vectorBatch.length >= this.batchSize) {
                  console.log(`🔄 Processing vector batch of ${vectorBatch.length} articles...`)
                  await this.vectorService.storeArticlesBatch(vectorBatch)
                  vectorBatch = []
                }
              }
            }
          } catch (insertError) {
            console.error('❌ Insert error:', insertError)
            result.errors += batchResults.length
            result.error_details.push({
              post_id: 'batch',
              error: insertError instanceof Error ? insertError.message : 'Unknown insert error'
            })
          }
        } else if (options.dryRun) {
          result.inserted += batchResults.length
          console.log(`🔍 Dry run: Would insert ${batchResults.length} articles`)
        }

        currentOffset += posts.length

        // Progress update
        const progress = Math.round((result.processed / totalPosts) * 100)
        console.log(`📈 Progress: ${progress}% (${result.processed}/${totalPosts})`)
      }

      // Process remaining vector batch
      if (options.enableVectors && this.vectorService && vectorBatch.length > 0) {
        console.log(`🔄 Processing final vector batch of ${vectorBatch.length} articles...`)
        await this.vectorService.storeArticlesBatch(vectorBatch)
      }

      result.duration = Date.now() - startTime
      result.success = result.errors === 0

      console.log(`🎯 Migration completed!`)
      console.log(`   Duration: ${Math.round(result.duration / 1000)}s`)
      console.log(`   Processed: ${result.processed}`)
      console.log(`   Inserted: ${result.inserted}`)
      console.log(`   Skipped: ${result.skipped}`)
      console.log(`   Errors: ${result.errors}`)

      if (options.enableVectors && this.vectorService) {
        const stats = await this.vectorService.getCollectionStats()
        console.log(`   Vector DB: ${stats.total_points} total points`)
      }

      return result

    } catch (error) {
      result.success = false
      result.duration = Date.now() - startTime
      result.error_details.push({
        post_id: 'migration',
        error: error instanceof Error ? error.message : 'Unknown migration error'
      })

      console.error('❌ Migration failed:', error)
      return result
    }
  }
} 