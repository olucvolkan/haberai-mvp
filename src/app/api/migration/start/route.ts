import { ETLService } from '@/lib/etl-service'
import { createMongoDBService } from '@/lib/mongodb'
import { NextRequest, NextResponse } from 'next/server'

interface MigrationRequest {
  connectionString: string
  databaseName: string
  channelName?: string
  fromDate?: string
  toDate?: string
  batchSize?: number
  dryRun?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: MigrationRequest = await request.json()
    
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
      return NextResponse.json(
        { error: 'connectionString and databaseName are required' },
        { status: 400 }
      )
    }

    // Create MongoDB service with provided connection
    const mongoService = new (class extends createMongoDBService().constructor {
      constructor() {
        super(connectionString, databaseName)
      }
    })()

    // Create ETL service
    const etlService = new ETLService(mongoService, batchSize)

    // Start migration (async)
    const migrationOptions = {
      channelName,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      dryRun
    }

    // Start migration process in background
    const migrationPromise = etlService.migrateAllPosts(migrationOptions)
    
    // Create job ID for tracking
    const jobId = `migration_${Date.now()}`

    // Store job promise for tracking (in production, use Redis or database)
    if (global.migrationJobs === undefined) {
      global.migrationJobs = new Map()
    }
    global.migrationJobs.set(jobId, migrationPromise)

    // Handle completion/errors
    migrationPromise
      .then(result => {
        console.log(`Migration ${jobId} completed:`, result)
      })
      .catch(error => {
        console.error(`Migration ${jobId} failed:`, error)
      })

    return NextResponse.json({
      jobId,
      status: 'started',
      message: 'Migration job started successfully',
      options: migrationOptions
    }, { status: 202 })

  } catch (error) {
    console.error('Migration start error:', error)
    return NextResponse.json(
      { error: 'Failed to start migration' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to start a migration',
    requiredFields: ['connectionString', 'databaseName'],
    optionalFields: ['channelName', 'fromDate', 'toDate', 'batchSize', 'dryRun'],
    example: {
      connectionString: 'mongodb://localhost:27017',
      databaseName: 'haberdb',
      channelName: 'MongoDB Import',
      batchSize: 50,
      dryRun: false
    }
  })
} 