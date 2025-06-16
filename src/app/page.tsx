export default function Home() {
  return (
    <div className="px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to HaberAI MVP
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          AI-powered news content generation platform that analyzes political stance and language patterns of news channels
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Dashboard</h3>
            <p className="text-gray-600 mb-4">
              Monitor channels, view analytics, and track content generation performance
            </p>
            <a 
              href="/dashboard" 
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              View Dashboard
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📺 Channel Management</h3>
            <p className="text-gray-600 mb-4">
              Add news channels, configure analysis settings, and manage political profiles
            </p>
            <a 
              href="/channels" 
              className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Manage Channels
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">✨ Content Generation</h3>
            <p className="text-gray-600 mb-4">
              Generate news content with AI that matches channel's political stance and style
            </p>
            <a 
              href="/generate" 
              className="inline-block bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Generate Content
            </a>
          </div>
        </div>
        
        <div className="mt-12 bg-white p-6 rounded-lg shadow-md max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🚀 System Architecture</h2>
          <div className="text-left">
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
              External News DB → Supabase Functions → Vector DB (Qdrant) → Content Generation<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br />
              Admin Panel (Next.js) ← Supabase PostgreSQL ← Analysis Engine
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          <p>🔧 <strong>Local Development:</strong> Supabase running on localhost:54323</p>
          <p>🎯 <strong>Status:</strong> Database tables created and ready for use</p>
        </div>
      </div>
    </div>
  )
} 