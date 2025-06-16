'use client'

import { useState } from 'react'

interface MigrationJob {
  jobId: string
  status: 'started' | 'running' | 'completed' | 'failed'
  total_records?: number
  processed_records?: number
  failed_records?: number
  started_at?: string
  completed_at?: string
  error_message?: string
}

export default function MigrationPanel() {
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentJob, setCurrentJob] = useState<MigrationJob | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    connectionString: '',
    databaseName: '',
    channelName: 'MongoDB Import',
    fromDate: '',
    toDate: '',
    batchSize: 50,
    dryRun: false
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
    }))
  }

  const startMigration = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/migration/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Migration failed to start')
      }

      const result = await response.json()
      setCurrentJob({ jobId: result.jobId, status: 'started' })
      setIsFormVisible(false)
      
      // Start polling for status
      pollJobStatus(result.jobId)
      
    } catch (error) {
      console.error('Migration error:', error)
      alert(error instanceof Error ? error.message : 'Failed to start migration')
    } finally {
      setIsLoading(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/migration/status/${jobId}`)
      
      if (!response.ok) {
        throw new Error('Failed to check status')
      }

      const status = await response.json()
      setCurrentJob(status)

      // Continue polling if still running
      if (status.status === 'running' || status.status === 'started') {
        setTimeout(() => pollJobStatus(jobId), 2000) // Poll every 2 seconds
      }
      
    } catch (error) {
      console.error('Status check error:', error)
    }
  }

  const resetMigration = () => {
    setCurrentJob(null)
    setIsFormVisible(false)
    setFormData({
      connectionString: '',
      databaseName: '',
      channelName: 'MongoDB Import',
      fromDate: '',
      toDate: '',
      batchSize: 50,
      dryRun: false
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'started':
      case 'running':
        return 'text-blue-600 bg-blue-100'
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getProgressPercentage = () => {
    if (!currentJob || !currentJob.total_records || currentJob.total_records === 0) return 0
    return Math.round((currentJob.processed_records || 0) / currentJob.total_records * 100)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">MongoDB Migration</h2>
        {!currentJob && (
          <button
            onClick={() => setIsFormVisible(!isFormVisible)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isFormVisible ? 'Cancel' : 'Start Migration'}
          </button>
        )}
      </div>

      {/* Migration Form */}
      {isFormVisible && !currentJob && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">Migration Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MongoDB Connection String *
              </label>
              <input
                type="text"
                name="connectionString"
                value={formData.connectionString}
                onChange={handleInputChange}
                placeholder="mongodb://localhost:27017"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database Name *
              </label>
              <input
                type="text"
                name="databaseName"
                value={formData.databaseName}
                onChange={handleInputChange}
                placeholder="haberdb"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel Name
              </label>
              <input
                type="text"
                name="channelName"
                value={formData.channelName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size
              </label>
              <input
                type="number"
                name="batchSize"
                value={formData.batchSize}
                onChange={handleInputChange}
                min="1"
                max="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date (Optional)
              </label>
              <input
                type="date"
                name="fromDate"
                value={formData.fromDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date (Optional)
              </label>
              <input
                type="date"
                name="toDate"
                value={formData.toDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="dryRun"
                checked={formData.dryRun}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">
                Dry Run (Test migration without inserting data)
              </span>
            </label>
          </div>
          
          <div className="mt-6 flex gap-3">
            <button
              onClick={startMigration}
              disabled={isLoading || !formData.connectionString || !formData.databaseName}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Starting...' : 'Start Migration'}
            </button>
            <button
              onClick={() => setIsFormVisible(false)}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Migration Status */}
      {currentJob && (
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Migration Status</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentJob.status)}`}>
              {currentJob.status.toUpperCase()}
            </span>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Job ID: {currentJob.jobId}</p>
            </div>
            
            {currentJob.total_records && (
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{currentJob.processed_records || 0} / {currentJob.total_records}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{getProgressPercentage()}% completed</p>
              </div>
            )}
            
            {currentJob.failed_records && currentJob.failed_records > 0 && (
              <div className="text-sm">
                <span className="text-red-600">Failed records: {currentJob.failed_records}</span>
              </div>
            )}
            
            {currentJob.started_at && (
              <div className="text-sm text-gray-600">
                Started: {new Date(currentJob.started_at).toLocaleString()}
              </div>
            )}
            
            {currentJob.completed_at && (
              <div className="text-sm text-gray-600">
                Completed: {new Date(currentJob.completed_at).toLocaleString()}
              </div>
            )}
            
            {currentJob.error_message && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                Error: {currentJob.error_message}
              </div>
            )}
          </div>
          
          {(currentJob.status === 'completed' || currentJob.status === 'failed') && (
            <div className="mt-4">
              <button
                onClick={resetMigration}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start New Migration
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Help Text */}
      {!isFormVisible && !currentJob && (
        <div className="text-gray-600 text-sm">
          <p className="mb-2">
            Import news articles from your MongoDB database to start analyzing and generating content.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Connect to your MongoDB instance</li>
            <li>Select date range (optional)</li>
            <li>Choose batch size for performance tuning</li>
            <li>Use dry run to test before actual migration</li>
          </ul>
        </div>
      )}
    </div>
  )
} 