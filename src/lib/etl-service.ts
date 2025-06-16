import { CreateChannelRequest } from '@/types/database'
import { MigrationJob, MongoPost, TransformationResult } from '@/types/mongodb'
import { MongoDBService, cleanHtmlContent, validatePostContent } from './mongodb'
import { newsArticlesApi, newsChannelsApi } from './supabase'

export class ETLService {
  private mongoService: MongoDBService
  private batchSize: number
  private defaultChannelId: string | null = null

  constructor(mongoService: MongoDBService, batchSize = 50) {
    this.mongoService = mongoService
    this.batchSize = batchSize
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
} 