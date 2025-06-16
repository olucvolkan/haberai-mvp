import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Check if job exists in global store (in production, use Redis or database)
    if (!global.migrationJobs || !global.migrationJobs.has(jobId)) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    const migrationPromise = global.migrationJobs.get(jobId)

    // Check if promise is resolved
    try {
      const result = await Promise.race([
        migrationPromise,
        Promise.resolve({ status: 'running' }) // Default to running if not resolved
      ])

      if (result.status === 'running') {
        return NextResponse.json({
          jobId,
          status: 'running',
          message: 'Migration is still in progress'
        })
      }

      // Migration completed
      return NextResponse.json({
        jobId,
        status: result.status,
        total_records: result.total_records,
        processed_records: result.processed_records,
        failed_records: result.failed_records,
        started_at: result.started_at,
        completed_at: result.completed_at,
        error_message: result.error_message
      })

    } catch (error) {
      // Migration failed
      return NextResponse.json({
        jobId,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
    }

  } catch (error) {
    console.error('Migration status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    )
  }
} 