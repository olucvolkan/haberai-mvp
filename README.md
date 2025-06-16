# HaberAI MVP - Political-Aware News Content Generation

🤖 **AI-powered news content generation platform that analyzes political stance and language patterns of news channels**

## 🎯 Project Overview

HaberAI is an intelligent content generation platform that:
- Analyzes news channels' political orientations and language patterns
- Generates consistent, channel-appropriate news content
- Maintains editorial consistency across generated articles
- Adapts writing style to match historical channel characteristics

## 🏗️ System Architecture

```
External News DB → Supabase Functions → Vector DB (Qdrant) → Content Generation
                        ↓
Admin Panel (Next.js) ← Supabase PostgreSQL ← Analysis Engine
```

## 🚀 MVP Features

### Core Capabilities
- [x] **Database Migration**: PostgreSQL → Vector DB data pipeline
- [x] **Political Analysis**: Multi-dimensional political stance detection
- [x] **Language Patterns**: Channel-specific writing style extraction
- [x] **Content Generation**: Context-aware news article creation
- [x] **Admin Interface**: Channel management and content generation UI

### Technical Stack
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Vector DB**: Qdrant
- **AI/ML**: OpenAI GPT-4 + Embeddings
- **Frontend**: Next.js 14 + Tailwind CSS
- **Authentication**: Supabase Auth

## 📝 Content Generation Interface

### User Input for News Generation
The platform uses a simple, intelligent input system for content generation:

**Primary Input Method:**
```
"Olay hakkında kısaca bilgi verin"
```

**Example Inputs:**
- `"TCMB politika faizini %17'ye yükseltti"`
- `"İstanbul'da metro grevi başladı"`
- `"AK Parti ekonomik reform paketini açıkladı"`
- `"Galatasaray Şampiyonlar Ligi'ne katıldı"`

**AI-Enhanced Processing:**
1. **Auto-Detection**: System automatically identifies entities, category, and event type
2. **Smart Suggestions**: Provides different angle options (breaking news, analysis, opinion)
3. **Channel Alignment**: Adapts content based on channel's political stance and writing style
4. **Similar Events**: References historical coverage for consistency

**Enhanced Input Options** (Optional):
- Target audience selection
- Desired content length
- Specific points to emphasize
- Topics to avoid

## 📊 Database Schema

### Core Tables
```sql
-- News channels and their configurations
news_channels (id, name, source_db_config, analysis_status)

-- Political and linguistic analysis results
channel_profiles (id, channel_id, political_stance, language_style, confidence_score)

-- Migrated news articles with vector references
news_articles (id, channel_id, title, content, vector_id, analysis_completed)

-- Event-based language templates
event_templates (id, channel_id, event_category, language_template, effectiveness_score)

-- Generated content with quality metrics
generated_content (id, channel_id, topic, content, consistency_scores, human_approved)
```

### Vector Database (Qdrant)
```json
{
  "collection": "news_embeddings",
  "vectors": { "size": 1536, "distance": "Cosine" },
  "payload": {
    "channel_id": "string",
    "political_score": "float",
    "event_category": "string",
    "content_preview": "string"
  }
}
```

## 🔧 API Endpoints

### Channel Management
```
GET    /api/channels              # List channels
POST   /api/channels              # Create channel
GET    /api/channels/{id}/profile # Get analysis results
```

### Data Pipeline
```
POST   /api/channels/{id}/migrate # Start data migration
GET    /api/channels/{id}/status  # Migration progress
POST   /api/channels/{id}/analyze # Analyze political stance
```

### Content Generation
```
POST   /api/generate              # Generate news content
GET    /api/similar-events        # Find similar historical events
GET    /api/generate/history      # Generation history
```

**Content Generation Request Example:**
```json
{
  "channelId": "uuid",
  "topic": "TCMB politika faizini %17'ye yükseltti",
  "contentType": "full",
  "targetAudience": "general",
  "desiredLength": "medium"
}
```

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+
- Supabase CLI
- Qdrant instance
- OpenAI API key

### Setup

1. **Clone Repository**
```bash
git clone https://github.com/olucvolkan/haberai-mvp.git
cd haberai-mvp
```

2. **Environment Setup**
```bash
cp .env.example .env.local
# Fill in your API keys and database URLs
```

3. **Supabase Setup**
```bash
npx supabase init
npx supabase start
npx supabase db reset
```

4. **Install Dependencies**
```bash
npm install
```

5. **Deploy Functions**
```bash
npx supabase functions deploy migrate-news-data
npx supabase functions deploy analyze-channel
npx supabase functions deploy generate-content
```

6. **Start Development**
```bash
npm run dev
```

## 📁 Project Structure

```
haberai-mvp/
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── migrate-news-data/
│   │   ├── analyze-channel/
│   │   ├── generate-content/
│   │   └── find-similar-events/
│   ├── migrations/          # Database schema
│   └── config.toml
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── dashboard/
│   │   ├── channels/
│   │   ├── generate/
│   │   └── api/
│   ├── components/          # React components
│   ├── lib/                 # Utilities
│   └── types/              # TypeScript definitions
├── docs/                   # Documentation
└── scripts/               # Development scripts
```

## 🔄 Development Workflow

### Phase 1: Data Pipeline (Week 1-2)
1. External database connection
2. ETL pipeline implementation
3. Vector embedding generation
4. Quality validation

### Phase 2: Analysis Engine (Week 3-4)
1. Political stance analysis
2. Language pattern extraction
3. Event categorization
4. Template generation

### Phase 3: Content Generation (Week 5-6)
1. Dynamic prompt creation
2. LLM integration
3. Consistency validation
4. Admin interface

## 📊 Success Metrics

### Technical Performance
- **Migration Speed**: 1M+ records in <4 hours
- **Analysis Accuracy**: 85%+ political stance detection
- **Generation Time**: <5 seconds per article
- **Consistency Score**: 80%+ style matching

### Business Outcomes
- **Setup Time**: <1 hour channel onboarding
- **Content Quality**: 70%+ approval rate
- **User Satisfaction**: 4+/5 rating

## 🧪 Testing Strategy

### Automated Testing
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Manual Testing
- Political analysis validation
- Content generation quality
- UI/UX functionality

## 🚀 Deployment

### Staging
```bash
# Deploy to staging
npm run deploy:staging
```

### Production
```bash
# Deploy to production
npm run deploy:production
```

## 📈 Monitoring & Analytics

- **Error Tracking**: Sentry integration
- **Performance**: Vercel Analytics
- **Usage Metrics**: Custom analytics dashboard
- **Quality Metrics**: Human feedback system

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Demo**: [https://haberai-mvp.vercel.app](https://haberai-mvp.vercel.app)
- **Documentation**: [docs/](docs/)
- **API Reference**: [docs/api.md](docs/api.md)
- **Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md)

## 📞 Support

For questions and support:
- Create an [Issue](https://github.com/olucvolkan/haberai-mvp/issues)
- Email: support@haberai.com
- Discord: [HaberAI Community](https://discord.gg/haberai)

---

**Built with ❤️ for the future of news content generation**