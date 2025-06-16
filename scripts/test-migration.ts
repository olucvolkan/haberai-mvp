#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { MongoClient } from 'mongodb'

// MongoDB Post structure based on the provided example
interface MongoPost {
  _id: any
  is_old_record?: boolean
  weight?: number
  created_by?: number
  updated_by?: number
  deleted_by?: number
  integer_id?: number
  old_id?: number
  post_type?: number
  author_id?: string | null
  created_at: Date
  updated_at: Date
  published_at?: Date
  short_title?: string
  title: string
  seo_title?: string
  summary?: string
  seo_description?: string
  seo_keywords?: string
  old_slug?: string
  slug?: string
  categories?: string[]
  hit?: number
  show_on_mainpage?: boolean
  location?: number
  old_related_posts_ids?: string[]
  topics?: string[]
  editor_id?: string | null
  source_id?: string | null
  show_text_on_image?: {
    post_headline?: boolean
  }
  image_description?: string | null
  commentable?: boolean
  redirect_link?: string | null
  show_ads?: boolean
  status?: number
  sort_date?: Date
  is_seo_news?: boolean
  attachments?: {
    images?: {
      post_cover?: {
        attachment_id?: string
        public_path?: string
      }
    }
  }
  content?: {
    text?: string
  }
}

// HTML content cleaner utility
function cleanHtmlContent(html: string): string {
  if (!html) return ''
  
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Content quality validator
function validatePostContent(post: MongoPost): { 
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  if (!post.title || post.title.trim().length === 0) {
    issues.push('Missing or empty title')
  }

  if (!post.content?.text || post.content.text.trim().length === 0) {
    issues.push('Missing or empty content')
  }

  const cleanContent = cleanHtmlContent(post.content?.text || '')
  if (cleanContent.length < 50) {
    issues.push('Content too short (minimum 50 characters)')
  }

  if (post.title && post.title.length > 200) {
    issues.push('Title too long (maximum 200 characters)')
  }

  if (post.status !== 1) {
    issues.push(`Post status is ${post.status} (not published)`)
  }

  return {
    isValid: issues.length === 0,
    issues
  }
}

async function testMongoDB() {
  console.log('🚀 Testing MongoDB Connection and Data Structure...\n')

  // Test configuration
  const config = {
    connectionString: process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
    databaseName: process.env.MONGODB_DATABASE_NAME || 'haberdb'
  }

  console.log('Configuration:')
  console.log(`- MongoDB Connection: ${config.connectionString}`)
  console.log(`- Database: ${config.databaseName}\n`)

  let mongoClient: MongoClient | null = null

  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...')
    mongoClient = new MongoClient(config.connectionString, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    
    await mongoClient.connect()
    console.log('✅ Connected to MongoDB successfully')

    const db = mongoClient.db(config.databaseName)

    // Test health check
    console.log('🔍 Performing health check...')
    await db.admin().ping()
    console.log('✅ Health check: PASSED')

    // Get posts collection
    const postsCollection = db.collection<MongoPost>('posts')

    // Test fetching posts count
    console.log('📊 Checking posts count...')
    const totalPosts = await postsCollection.countDocuments({ status: 1 })
    console.log(`✅ Found ${totalPosts} published posts in database`)

    if (totalPosts === 0) {
      console.log('⚠️  No published posts found in database.')
      console.log('💡 Make sure you have posts with status = 1 in your MongoDB collection.')
      return
    }

    // Test fetching a small batch of posts
    console.log('📄 Fetching sample posts...')
    const samplePosts = await postsCollection
      .find({ status: 1 })
      .sort({ _id: 1 })
      .limit(3)
      .toArray()
    
    console.log(`✅ Retrieved ${samplePosts.length} sample posts`)

    // Display sample post information
    samplePosts.forEach((post, index) => {
      console.log(`\n📰 Sample Post ${index + 1}:`)
      console.log(`   ID: ${post._id}`)
      console.log(`   Title: ${post.title}`)
      console.log(`   Published: ${post.published_at?.toISOString() || 'N/A'}`)
      console.log(`   Content Length: ${post.content?.text?.length || 0} chars`)
      console.log(`   Status: ${post.status}`)
      console.log(`   Categories: ${post.categories?.length || 0}`)
      console.log(`   Topics: ${post.topics?.length || 0}`)
    })

    // Test content validation and transformation
    console.log('\n🔄 Testing content validation and transformation...')
    
    if (samplePosts.length > 0) {
      const testPost = samplePosts[0]
      const validation = validatePostContent(testPost)
      
      console.log('✅ Validation result:')
      console.log(`   Valid: ${validation.isValid}`)
      
      if (!validation.isValid) {
        console.log(`   Issues: ${validation.issues.join(', ')}`)
      } else {
        // Test HTML cleaning
        const rawContent = testPost.content?.text || ''
        const cleanContent = cleanHtmlContent(rawContent)
        
        console.log('✅ Content transformation:')
        console.log(`   Original length: ${rawContent.length} chars`)
        console.log(`   Cleaned length: ${cleanContent.length} chars`)
        console.log(`   HTML removed: ${rawContent.length - cleanContent.length} chars`)
        
        // Show content preview
        const preview = cleanContent.substring(0, 200)
        console.log(`   Preview: ${preview}${cleanContent.length > 200 ? '...' : ''}`)
      }
    }

    // Test collections structure
    console.log('\n📋 Checking database collections...')
    const collections = await db.listCollections().toArray()
    console.log('✅ Available collections:')
    collections.forEach(col => {
      console.log(`   - ${col.name}`)
    })

    // Check for related collections
    const hasCategories = collections.some(col => col.name === 'categories')
    const hasTopics = collections.some(col => col.name === 'topics')
    const hasSources = collections.some(col => col.name === 'sources')

    console.log('\n🔗 Related collections:')
    console.log(`   Categories: ${hasCategories ? '✅ Found' : '❌ Not found'}`)
    console.log(`   Topics: ${hasTopics ? '✅ Found' : '❌ Not found'}`)
    console.log(`   Sources: ${hasSources ? '✅ Found' : '❌ Not found'}`)

    console.log('\n🎯 MongoDB test completed successfully!')
    console.log('\n📋 Summary:')
    console.log(`- Total published posts: ${totalPosts}`)
    console.log(`- Sample posts retrieved: ${samplePosts.length}`)
    console.log(`- Database collections: ${collections.length}`)
    
    console.log('\n🚀 Next steps:')
    console.log('1. MongoDB connection is working!')
    console.log('2. Now we can proceed with vector database integration')
    console.log('3. Start development server: npm run dev')
    console.log('4. Open http://localhost:3000/dashboard for migration UI')

  } catch (error) {
    console.error('❌ MongoDB test failed:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.log('\n💡 Connection Tips:')
        console.log('- Make sure MongoDB is running on the specified connection string')
        console.log('- Check your connection string format: mongodb://localhost:27017')
        console.log('- Verify the database name exists')
        console.log('- Test connection: mongosh "' + config.connectionString + '"')
      } else if (error.message.includes('authentication')) {
        console.log('\n💡 Authentication Tips:')
        console.log('- Check your MongoDB credentials')
        console.log('- Make sure the user has read access to the database')
        console.log('- Verify username/password in connection string')
      } else if (error.message.includes('timeout')) {
        console.log('\n💡 Timeout Tips:')
        console.log('- Check network connectivity')
        console.log('- Verify MongoDB server is responding')
        console.log('- Try increasing timeout values')
      }
    }
  } finally {
    if (mongoClient) {
      await mongoClient.close()
      console.log('🔌 Disconnected from MongoDB')
    }
  }
}

// Run the test
if (require.main === module) {
  testMongoDB().catch(console.error)
}

export { testMongoDB }
