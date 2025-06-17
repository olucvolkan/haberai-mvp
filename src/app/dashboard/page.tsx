'use client'

import { newsChannelsApi } from '@/lib/supabase'
import { NewsChannel } from '@/types/database'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [channels, setChannels] = useState<NewsChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadChannels() {
      try {
        setLoading(true)
        const data = await newsChannelsApi.getAll()
        setChannels(data)
        setError(null)
      } catch (err) {
        console.error('Error loading channels:', err)
        setError('Failed to load channels')
      } finally {
        setLoading(false)
      }
    }

    loadChannels()
  }, [])

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Monitor your news channels and content generation performance</p>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Database</p>
              <p className="text-2xl font-bold text-gray-900">Online</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <span className="text-blue-600 font-bold">📺</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Channels</p>
              <p className="text-2xl font-bold text-gray-900">{channels.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
              <span className="text-yellow-600 font-bold">⚡</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Analyzing</p>
              <p className="text-2xl font-bold text-gray-900">
                {channels.filter(c => c.analysis_status === 'in_progress').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              <span className="text-green-600 font-bold">✅</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {channels.filter(c => c.analysis_status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Channels Table */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">News Channels</h2>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading channels...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-600">{error}</p>
              <p className="text-sm text-gray-500 mt-2">
                Make sure your environment variables are set correctly and Supabase is running.
              </p>
            </div>
          ) : channels.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-600">No channels found</p>
              <p className="text-sm text-gray-500 mt-2">
                Add your first news channel to get started with content analysis.
              </p>
              <a 
                href="/channels" 
                className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Add Channel
              </a>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Channel Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {channels.map((channel) => (
                  <tr key={channel.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{channel.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        channel.analysis_status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : channel.analysis_status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : channel.analysis_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {channel.analysis_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(channel.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a href={`/channels/${channel.id}`} className="text-blue-600 hover:text-blue-900">
                        View Details
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <a 
              href="/channels" 
              className="block w-full text-left p-3 rounded border hover:bg-gray-50"
            >
              <div className="font-medium text-gray-900">Add New Channel</div>
              <div className="text-sm text-gray-600">Connect a new news source for analysis</div>
            </a>
            <a 
              href="/generate" 
              className="block w-full text-left p-3 rounded border hover:bg-gray-50"
            >
              <div className="font-medium text-gray-900">Generate Content</div>
              <div className="text-sm text-gray-600">Create AI-powered news articles</div>
            </a>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Database:</span>
              <span className="text-green-600 font-medium">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Supabase Studio:</span>
              <a href="http://localhost:54323" target="_blank" className="text-blue-600 hover:underline">
                Open Studio
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">API Endpoint:</span>
              <span className="text-gray-800 font-mono text-xs">127.0.0.1:54321</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 