#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { ETLService } from '../src/lib/etl-service'
import { MongoDBService } from '../src/lib/mongodb'
import { supabase } from '../src/lib/supabase'
import { VectorService } from '../src/lib/vector-service'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function verifySupabaseConnection(): Promise<boolean> {
  try {
    console.log('🔍 Verifying Supabase connection...')
    
    // Test connection by checking auth status
    const { data, error } = await supabase.auth.getSession()
    
    if (error && error.message !== 'Auth session missing!') {
      console.error('❌ Supabase connection failed:', error.message)
      return false
    }
    
    // Test database access by checking news_channels table
    const { error: dbError } = await supabase
      .from('news_channels')
      .select('count')
      .limit(1)
    
    if (dbError) {
      console.error('❌ Supabase database access failed:', dbError.message)
      return false
    }
    
    console.log('✅ Supabase connection verified')
    return true
  } catch (error) {
    console.error('❌ Supabase connection error:', error)
    return false
  }
}

async function verifyQdrantConnection(vectorService: VectorService): Promise<boolean> {
  try {
    console.log('🔍 Verifying Qdrant connection...')
    
    // Test connection by getting collection info
    const stats = await vectorService.getCollectionStats()
    
    console.log('✅ Qdrant connection verified')
    console.log(`   Collection: news_embeddings`)
    console.log(`   Total points: ${stats.total_points}`)
    console.log(`   Indexed points: ${stats.indexed_points}`)
    console.log(`   Status: ${stats.status}`)
    
    return true
  } catch (error) {
    console.error('❌ Qdrant connection failed:', error)
    
    // Try to initialize collection if it doesn't exist
    try {
      console.log('🔧 Attempting to initialize Qdrant collection...')
      await vectorService.initializeCollection()
      
      const newStats = await vectorService.getCollectionStats()
      console.log('✅ Qdrant collection initialized successfully')
      console.log(`   Collection: news_embeddings`)
      console.log(`   Total points: ${newStats.total_points}`)
      console.log(`   Indexed points: ${newStats.indexed_points}`)
      console.log(`   Status: ${newStats.status}`)
      
      return true
    } catch (initError) {
      console.error('❌ Failed to initialize Qdrant collection:', initError)
      return false
    }
  }
}

async function verifyMongoDBConnection(mongoService: MongoDBService): Promise<boolean> {
  try {
    console.log('🔍 Verifying MongoDB connection...')
    
    await mongoService.connect()
    const isHealthy = await mongoService.healthCheck()
    
    if (!isHealthy) {
      console.error('❌ MongoDB health check failed')
      return false
    }
    
    // Test by getting post count
    const totalPosts = await mongoService.getPostCount()
    
    console.log('✅ MongoDB connection verified')
    console.log(`   Total posts available: ${totalPosts}`)
    
    return true
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Usage: npm run migrate <mongodb_connection_string>')
    console.log('Example: npm run migrate "mongodb://username:password@host:port/database"')
    process.exit(1)
  }

  const mongoConnectionString = args[0]
  const databaseName = process.env.MONGODB_DATABASE_NAME || 'haberdb'

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in environment variables')
    console.error('Make sure .env.local file exists and contains required variables')
    process.exit(1)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in environment variables')
    console.error('Make sure .env.local file exists and contains required variables')
    process.exit(1)
  }

  console.log('🚀 Starting MongoDB to Supabase migration...')
  console.log(`📊 Batch size: 500 records`)
  console.log(`🔗 Target database: ${databaseName}`)
  console.log(`🔗 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`🔗 Vector DB: ${process.env.QDRANT_URL || 'localhost:6333'}`)
  console.log('')

  try {
    // Initialize services
    console.log('🔧 Initializing services...')
    const mongoService = new MongoDBService(mongoConnectionString, databaseName)
    const vectorService = new VectorService()
    
    console.log('✅ Services initialized')
    console.log('')

    // STEP 1: Verify all connections
    console.log('🔗 STEP 1: Verifying database connections...')
    console.log('═══════════════════════════════════════════')

    const supabaseOk = await verifySupabaseConnection()
    const qdrantOk = await verifyQdrantConnection(vectorService)
    const mongoOk = await verifyMongoDBConnection(mongoService)

    console.log('')
    console.log('📋 Connection Summary:')
    console.log(`   Supabase: ${supabaseOk ? '✅ Connected' : '❌ Failed'}`)
    console.log(`   Qdrant:   ${qdrantOk ? '✅ Connected' : '❌ Failed'}`)
    console.log(`   MongoDB:  ${mongoOk ? '✅ Connected' : '❌ Failed'}`)

    if (!supabaseOk || !qdrantOk || !mongoOk) {
      console.error('')
      console.error('💥 Connection verification failed!')
      console.error('Please check your database configurations and try again.')
      process.exit(1)
    }

    console.log('')
    console.log('🎉 All connections verified successfully!')
    console.log('')

    // STEP 2: Initialize ETL Service and start migration
    console.log('🚀 STEP 2: Starting Vector-Only migration process...')
    console.log('═══════════════════════════════════════════')

    const etlService = new ETLService(
      mongoService,
      500, // batchSize
      vectorService
    )

    // Get total count
    console.log('🔢 Counting total records...')
    const totalCount = await mongoService.getPostCount()
    console.log(`📈 Total records to migrate: ${totalCount}`)

    if (totalCount === 0) {
      console.log('⚠️  No records found to migrate')
      await mongoService.disconnect()
      return
    }

    // Start vector-only migration
    console.log(`🔄 Starting Vector-Only migration of ${totalCount} records`)
    console.log('📊 Processing: [Vector Database Only]')
    console.log('───────────────────────────────────────────')

    const startTime = Date.now()

    try {
      // Process only first 500 records for testing
      const result = await etlService.migrateToVectorOnly({
        limit: 500
      })

      const endTime = Date.now()
      const totalDuration = Math.round((endTime - startTime) / 1000)

      // Final report
      console.log('')
      console.log('🎯 MIGRATION COMPLETED!')
      console.log('═══════════════════════════════════════════')
      console.log(`✅ Migration Results:`)
      console.log(`   • Records processed: ${result.processed}`)
      console.log(`   • Records inserted: ${result.inserted}`)
      console.log(`   • Records skipped: ${result.skipped}`)
      console.log(`   • Errors: ${result.errors}`)
      console.log(`   • Total duration: ${totalDuration}s`)
      console.log(`   • Average speed: ${Math.round(result.processed / totalDuration)} records/sec`)

      if (result.error_details && result.error_details.length > 0) {
        console.log(``)
        console.log(`❌ Error details:`)
        result.error_details.slice(0, 10).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.post_id}: ${error.error}`)
        })
        if (result.error_details.length > 10) {
          console.log(`   ... and ${result.error_details.length - 10} more errors`)
        }
      }

      // Get final stats from vector database
      try {
        const finalStats = await vectorService.getCollectionStats()
        console.log(``)
        console.log(`📊 Vector Database Final Stats:`)
        console.log(`   • Total vectors stored: ${finalStats.total_points}`)
        console.log(`   • Indexed vectors: ${finalStats.indexed_points}`)
        console.log(`   • Collection status: ${finalStats.status}`)
      } catch (statsError) {
        console.log(`   • Vector stats: Unable to retrieve`)
      }

    } catch (error) {
      console.error(`❌ Migration error:`, error)
      throw error
    }

    console.log('')
    console.log('🎉 Migration completed successfully!')

  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  } finally {
    // Cleanup
    try {
      console.log('🧹 Cleaning up connections...')
      process.exit(0)
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError)
      process.exit(1)
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Migration interrupted by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Migration terminated')
  process.exit(0)
})

main().catch((error) => {
  console.error('💥 Unhandled error:', error)
  process.exit(1)
}) 