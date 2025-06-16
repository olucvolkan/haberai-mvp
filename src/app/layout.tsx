import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'HaberAI MVP - Political-Aware News Content Generation',
  description: 'AI-powered news content generation platform that analyzes political stance and language patterns of news channels',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold text-gray-900">
                    🤖 HaberAI MVP
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                    Dashboard
                  </a>
                  <a href="/channels" className="text-gray-600 hover:text-gray-900">
                    Channels
                  </a>
                  <a href="/generate" className="text-gray-600 hover:text-gray-900">
                    Generate
                  </a>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
} 