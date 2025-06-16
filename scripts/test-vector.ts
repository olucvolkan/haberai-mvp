#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import type { NewsArticleVector } from '../src/lib/vector-service'
import { createVectorService } from '../src/lib/vector-service'

async function testVectorDatabase() {
  console.log('🚀 Testing Vector Database (Qdrant) Integration...\n')

  // Test configuration
  const config = {
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    qdrantApiKey: process.env.QDRANT_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY || '',
  }

  console.log('Configuration:')
  console.log(`- Qdrant URL: ${config.qdrantUrl}`)
  console.log(`- Qdrant API Key: ${config.qdrantApiKey ? '***' : 'Not set'}`)
  console.log(`- OpenAI API Key: ${config.openaiApiKey ? '***' : 'Not set'}\n`)

  if (!config.openaiApiKey) {
    console.log('❌ OpenAI API key is required for vector database testing')
    console.log('💡 Please set OPENAI_API_KEY in your .env.local file')
    return
  }

  try {
    // Create vector service
    console.log('📦 Creating vector service...')
    const vectorService = createVectorService()
    console.log('✅ Vector service created successfully')

    // Test health check
    console.log('🔍 Performing health check...')
    const isHealthy = await vectorService.healthCheck()
    console.log(`✅ Health check: ${isHealthy ? 'PASSED' : 'FAILED'}`)

    if (!isHealthy) {
      console.log('❌ Vector database is not healthy.')
      console.log('💡 Make sure Qdrant is running on the specified URL')
      console.log('💡 You can run Qdrant with Docker: docker run -p 6333:6333 qdrant/qdrant')
      return
    }

    // Initialize collection
    console.log('📋 Initializing collection...')
    await vectorService.initializeCollection()
    console.log('✅ Collection initialized successfully')

    // Get collection stats
    console.log('📊 Getting collection statistics...')
    const stats = await vectorService.getCollectionStats()
    console.log(`✅ Collection stats:`)
    console.log(`   Total points: ${stats.total_points}`)
    console.log(`   Indexed points: ${stats.indexed_points}`)
    console.log(`   Status: ${stats.status}`)

    // Test embedding generation
    console.log('\n🔄 Testing embedding generation...')
    const testText = 'TCMB politika faizini %17\'ye yükseltti. Merkez Bankası\'nın aldığı bu karar ekonomi çevrelerinde büyük yankı uyandırdı.'
    console.log(`Test text: ${testText}`)
    
    const embedding = await vectorService.generateEmbedding(testText)
    console.log(`✅ Generated embedding with ${embedding.length} dimensions`)
    console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)

    // Test storing a sample article
    console.log('\n📝 Testing article storage...')
    const sampleArticle: NewsArticleVector = {
      id: 'test-article-1',
      channel_id: 'test-channel',
      title: 'TCMB Politika Faizini Yükseltti',
      content: 'Türkiye Cumhuriyet Merkez Bankası (TCMB), politika faizini %17\'ye yükselterek enflasyonla mücadele kapsamında önemli bir adım attı. Bu karar, ekonomi uzmanları tarafından olumlu karşılandı.',
      published_at: new Date(),
      categories: ['ekonomi', 'finans'],
      topics: ['merkez bankası', 'faiz', 'enflasyon'],
      political_score: 0.1,
      event_category: 'economy',
      source_url: '/tcmb-faiz-karari'
    }

    await vectorService.storeArticle(sampleArticle)
    console.log('✅ Sample article stored successfully')

    // Test batch storage
    console.log('\n📦 Testing batch storage...')
    const batchArticles: NewsArticleVector[] = [
      {
        id: 'test-article-2',
        channel_id: 'test-channel',
        title: 'Galatasaray Şampiyonlar Ligi\'nde',
        content: 'Galatasaray, Şampiyonlar Ligi\'nde önemli bir galibiyet elde ederek gruptan çıkma şansını artırdı. Sarı-kırmızılılar, taraftarlarını sevindirdi.',
        published_at: new Date(),
        categories: ['spor', 'futbol'],
        topics: ['galatasaray', 'şampiyonlar ligi'],
        event_category: 'sports'
      },
      {
        id: 'test-article-3',
        channel_id: 'test-channel',
        title: 'Yapay Zeka Teknolojisinde Yeni Gelişmeler',
        content: 'Yapay zeka alanında yaşanan son gelişmeler, teknoloji sektörünü heyecanlandırıyor. Yeni algoritmalar, daha verimli çözümler sunuyor.',
        published_at: new Date(),
        categories: ['teknoloji', 'yapay zeka'],
        topics: ['ai', 'teknoloji'],
        event_category: 'technology'
      }
    ]

    await vectorService.storeArticlesBatch(batchArticles)
    console.log(`✅ Stored ${batchArticles.length} articles in batch`)

    // Test similarity search
    console.log('\n🔍 Testing similarity search...')
    const searchQuery = 'ekonomi ve faiz oranları hakkında haberler'
    console.log(`Search query: ${searchQuery}`)
    
    const searchResults = await vectorService.searchSimilar(searchQuery, {
      limit: 3,
      threshold: 0.5
    })

    console.log(`✅ Found ${searchResults.length} similar articles:`)
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.payload.title} (Score: ${result.score.toFixed(3)})`)
      console.log(`      Categories: ${result.payload.categories.join(', ')}`)
      console.log(`      Preview: ${result.payload.content_preview.substring(0, 100)}...`)
    })

    // Test filtered search
    console.log('\n🎯 Testing filtered search...')
    const filteredResults = await vectorService.searchSimilar('spor haberleri', {
      limit: 2,
      filter: {
        categories: ['spor', 'futbol']
      }
    })

    console.log(`✅ Found ${filteredResults.length} sports articles:`)
    filteredResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.payload.title} (Score: ${result.score.toFixed(3)})`)
    })

    // Test channel-specific search
    console.log('\n📺 Testing channel-specific search...')
    const channelResults = await vectorService.findByChannelAndEvent('test-channel', 'economy', 2)
    console.log(`✅ Found ${channelResults.length} economy articles for test-channel:`)
    channelResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.payload.title}`)
    })

    // Final collection stats
    console.log('\n📊 Final collection statistics...')
    const finalStats = await vectorService.getCollectionStats()
    console.log(`✅ Final stats:`)
    console.log(`   Total points: ${finalStats.total_points}`)
    console.log(`   Indexed points: ${finalStats.indexed_points}`)
    console.log(`   Status: ${finalStats.status}`)

    console.log('\n🎯 Vector database test completed successfully!')
    console.log('\n📋 Summary:')
    console.log(`- Health check: ✅ PASSED`)
    console.log(`- Collection initialized: ✅ YES`)
    console.log(`- Embedding generation: ✅ WORKING`)
    console.log(`- Article storage: ✅ WORKING`)
    console.log(`- Batch storage: ✅ WORKING`)
    console.log(`- Similarity search: ✅ WORKING`)
    console.log(`- Filtered search: ✅ WORKING`)
    console.log(`- Total articles stored: ${finalStats.total_points}`)
    
    console.log('\n🚀 Next steps:')
    console.log('1. Vector database is ready for production use!')
    console.log('2. You can now run migration with vector integration enabled')
    console.log('3. Use the dashboard to start migrating MongoDB data with embeddings')

  } catch (error) {
    console.error('❌ Vector database test failed:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.log('\n💡 Connection Tips:')
        console.log('- Make sure Qdrant is running on the specified URL')
        console.log('- Start Qdrant with Docker: docker run -p 6333:6333 qdrant/qdrant')
        console.log('- Check your QDRANT_URL in .env.local')
      } else if (error.message.includes('API key')) {
        console.log('\n💡 API Key Tips:')
        console.log('- Check your OpenAI API key in .env.local')
        console.log('- Make sure the API key has sufficient credits')
        console.log('- Verify the API key format')
      } else if (error.message.includes('quota')) {
        console.log('\n💡 Quota Tips:')
        console.log('- You may have exceeded your OpenAI API quota')
        console.log('- Check your OpenAI account billing and usage')
        console.log('- Try again later or upgrade your plan')
      }
    }
  }
}

// Run the test
if (require.main === module) {
  testVectorDatabase().catch(console.error)
}

export { testVectorDatabase }
