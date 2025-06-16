import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { MongoClient } from 'https://deno.land/x/mongo@v0.32.0/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MigrationRequest {
  connectionString: string
  databaseName: string
  channelName?: string
  fromDate?: string
  toDate?: string
  batchSize?: number
  dryRun?: boolean
}

interface MigrationStatus {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  totalRecords: number
  processedRecords: number
  failedRecords: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  lastProcessedId?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { method, url } = req
    const urlPath = new URL(url).pathname
    const segments = urlPath.split('/').filter(Boolean)

    // GET /migrate-news-data/status/{jobId} - Get migration status
    if (method === 'GET' && segments[2] === 'status' && segments[3]) {
      const jobId = segments[3]
      
      // In a real implementation, you'd store job status in a database
      // For now, return a mock response
      const status: MigrationStatus = {
        jobId,
        status: 'completed',
        totalRecords: 1000,
        processedRecords: 1000,
        failedRecords: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }

      return new Response(JSON.stringify(status), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // POST /migrate-news-data - Start migration
    if (method === 'POST') {
      const body: MigrationRequest = await req.json()
      
      const {
        connectionString,
        databaseName,
        channelName = 'MongoDB Import',
        fromDate,
        toDate,
        batchSize = 50,
        dryRun = false
      } = body

      // Validate required fields
      if (!connectionString || !databaseName) {
        return new Response(
          JSON.stringify({ error: 'connectionString and databaseName are required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      const jobId = `migration_${Date.now()}`
      
      // Start migration process (async)
      const migrationPromise = performMigration({
        jobId,
        connectionString,
        databaseName,
        channelName,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        batchSize,
        dryRun,
        supabase
      })

      // Don't await the migration, return job ID immediately
      migrationPromise.catch(error => {
        console.error(`Migration ${jobId} failed:`, error)
      })

      const response: MigrationStatus = {
        jobId,
        status: 'running',
        totalRecords: 0,
        processedRecords: 0,
        failedRecords: 0,
        startedAt: new Date().toISOString()
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202,
      })
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function performMigration(options: {
  jobId: string
  connectionString: string
  databaseName: string
  channelName: string
  fromDate?: Date
  toDate?: Date
  batchSize: number
  dryRun: boolean
  supabase: any
}) {
  const {
    jobId,
    connectionString,
    databaseName,
    channelName,
    fromDate,
    toDate,
    batchSize,
    dryRun,
    supabase
  } = options

  console.log(`Starting migration ${jobId}`)

  let mongoClient: MongoClient | null = null

  try {
    // Connect to MongoDB
    mongoClient = new MongoClient()
    await mongoClient.connect(connectionString)
    const db = mongoClient.database(databaseName)
    const postsCollection = db.collection('posts')

    // Ensure channel exists in Supabase
    let channelId: string

    const { data: existingChannels } = await supabase
      .from('news_channels')
      .select('id')
      .eq('name', channelName)

    if (existingChannels && existingChannels.length > 0) {
      channelId = existingChannels[0].id
    } else {
      const { data: newChannel, error } = await supabase
        .from('news_channels')
        .insert([{
          name: channelName,
          source_db_config: {
            type: 'mongodb',
            database: databaseName,
            migrated_at: new Date().toISOString()
          }
        }])
        .select('id')
        .single()

      if (error) throw error
      channelId = newChannel.id
    }

    // Build query
    const query: any = { status: 1 }
    if (fromDate || toDate) {
      query.published_at = {}
      if (fromDate) query.published_at.$gte = fromDate
      if (toDate) query.published_at.$lte = toDate
    }

    // Get total count
    const totalCount = await postsCollection.countDocuments(query)
    console.log(`Found ${totalCount} posts to migrate for job ${jobId}`)

    if (dryRun) {
      console.log(`DRY RUN: Would migrate ${totalCount} posts`)
      return
    }

    // Process in batches
    let processed = 0
    let failed = 0
    let skip = 0

    const cursor = postsCollection.find(query).sort({ _id: 1 })

    for await (const post of cursor) {
      try {
        // Validate post
        if (!post.title || !post.content?.text) {
          skip++
          continue
        }

        // Clean HTML content
        const cleanContent = cleanHtmlContent(post.content.text)
        
        // Create summary
        let summary = post.summary || post.seo_description || ''
        if (!summary && cleanContent) {
          summary = cleanContent.substring(0, 200)
          if (cleanContent.length > 200) {
            summary += '...'
          }
        }

        // Prepare article data
        const articleData = {
          channel_id: channelId,
          title: post.title,
          content: cleanContent,
          summary: summary || null,
          published_at: post.published_at ? new Date(post.published_at).toISOString() : null,
          analysis_completed: false,
          migrated_at: new Date().toISOString()
        }

        // Insert into Supabase
        const { error } = await supabase
          .from('news_articles')
          .insert([articleData])

        if (error) {
          console.error(`Failed to insert post ${post._id}:`, error)
          failed++
        } else {
          processed++
        }

        // Log progress every 100 records
        if ((processed + failed + skip) % 100 === 0) {
          console.log(`Job ${jobId} progress: ${processed} success, ${failed} failed, ${skip} skipped`)
        }

      } catch (error) {
        console.error(`Error processing post ${post._id}:`, error)
        failed++
      }
    }

    console.log(`Migration ${jobId} completed: ${processed} success, ${failed} failed, ${skip} skipped`)

  } catch (error) {
    console.error(`Migration ${jobId} error:`, error)
    throw error
  } finally {
    if (mongoClient) {
      await mongoClient.close()
    }
  }
}

function cleanHtmlContent(html: string): string {
  if (!html) return ''
  
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/migrate-news-data' \
    --header 'Authorization: Bearer [YOUR_SERVICE_ROLE_KEY]' \
    --header 'Content-Type: application/json' \
    --data '{"connectionString":"mongodb://localhost:27017","databaseName":"haberdb"}'

*/ 