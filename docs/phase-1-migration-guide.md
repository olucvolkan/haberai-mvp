# Phase 1: MongoDB Migration Guide

## 🎯 Overview

Phase 1 implements a comprehensive ETL (Extract, Transform, Load) pipeline that migrates news articles from MongoDB to Supabase PostgreSQL with data validation, HTML cleaning, and batch processing.

## 🏗️ Architecture

```
MongoDB Source DB → ETL Service → Transformation → Supabase PostgreSQL
                      ↓              ↓                ↓
                  Validation     HTML Cleaning    Channel Creation
                  Pagination     Metadata Build   Progress Tracking
```

## 🚀 Features Implemented

### Core ETL Pipeline
- ✅ **MongoDB Connection**: Robust connection handling with health checks
- ✅ **Data Extraction**: Paginated fetching with cursor-based pagination
- ✅ **Content Validation**: Title, content, and quality checks
- ✅ **HTML Cleaning**: Removes scripts, styles, and sanitizes content
- ✅ **Batch Processing**: Configurable batch sizes for performance
- ✅ **Error Handling**: Comprehensive error tracking and recovery

### Data Transformation
- ✅ **Content Cleaning**: HTML-to-text conversion
- ✅ **Summary Generation**: Auto-generated summaries from content
- ✅ **Metadata Preservation**: Source database metadata retention
- ✅ **Channel Management**: Automatic channel creation and assignment

### User Interface
- ✅ **Migration Panel**: React component for migration control
- ✅ **Progress Tracking**: Real-time migration status and progress bars
- ✅ **Configuration UI**: MongoDB connection and migration settings
- ✅ **Error Display**: User-friendly error messages and resolution tips

### API Endpoints
- ✅ **Migration Start**: `POST /api/migration/start`
- ✅ **Status Check**: `GET /api/migration/status/{jobId}`
- ✅ **Edge Functions**: Supabase serverless functions for cloud processing

## 📂 File Structure

```
haberai-mvp/
├── src/
│   ├── types/
│   │   ├── mongodb.ts          # MongoDB data structures
│   │   └── database.ts         # Existing Supabase types
│   ├── lib/
│   │   ├── mongodb.ts          # MongoDB connection and querying
│   │   ├── etl-service.ts      # ETL transformation logic
│   │   └── supabase.ts         # Existing Supabase client
│   ├── components/
│   │   └── MigrationPanel.tsx  # Migration UI component
│   └── app/
│       ├── api/
│       │   └── migration/      # Migration API endpoints
│       └── dashboard/
│           └── page.tsx        # Updated dashboard with migration
├── supabase/
│   └── functions/
│       └── migrate-news-data/  # Edge function for cloud migration
├── scripts/
│   └── test-migration.ts       # Migration testing script
└── docs/
    └── phase-1-migration-guide.md
```

## 🔧 Setup Instructions

### 1. Environment Variables

Add to your `.env.local`:

```bash
# MongoDB Source Database
MONGODB_CONNECTION_STRING=mongodb://localhost:27017
MONGODB_DATABASE_NAME=haberdb

# Existing Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Install Dependencies

```bash
npm install mongodb @types/mongodb tsx
```

### 3. Test MongoDB Connection

```bash
npm run test:migration
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Access Migration Interface

Visit: `http://localhost:3000/dashboard`

## 📋 Usage Guide

### Starting a Migration

1. **Open Dashboard**: Navigate to the migration panel
2. **Configure Connection**: Enter MongoDB connection details:
   - Connection String: `mongodb://your-host:27017`
   - Database Name: Your source database name
   - Channel Name: Name for the imported channel
3. **Set Options**:
   - Batch Size: Records per batch (default: 50)
   - Date Range: Optional filtering by publication date
   - Dry Run: Test mode without data insertion
4. **Start Migration**: Click "Start Migration"

### Monitoring Progress

- **Real-time Status**: Progress bar and record counts
- **Job Tracking**: Unique job ID for status checking
- **Error Reporting**: Failed records with error details
- **Completion Summary**: Final statistics and results

### Configuration Options

| Option | Description | Default | Range |
|--------|-------------|---------|-------|
| Batch Size | Records processed per batch | 50 | 1-1000 |
| Connection Timeout | MongoDB connection timeout | 5s | 1-30s |
| From Date | Start date filter (optional) | - | Any date |
| To Date | End date filter (optional) | - | Any date |
| Dry Run | Test mode (no data insertion) | false | true/false |

## 🧪 Testing

### Local Testing

```bash
# Test MongoDB connection and data structure
npm run test:migration

# Test transformation logic
npm run test # When unit tests are implemented
```

### Edge Function Testing

```bash
# Deploy to Supabase
npx supabase functions deploy migrate-news-data

# Test via curl
curl -X POST 'https://your-project.supabase.co/functions/v1/migrate-news-data' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "connectionString": "mongodb://localhost:27017",
    "databaseName": "haberdb",
    "dryRun": true
  }'
```

## 🔍 Troubleshooting

### Common Issues

**MongoDB Connection Failed**
```
Error: ECONNREFUSED
```
- Check MongoDB is running
- Verify connection string format
- Test network connectivity

**Authentication Error**
```
Error: Authentication failed
```
- Verify MongoDB credentials
- Check user permissions
- Ensure database access rights

**Migration Hangs**
```
Status: running (no progress)
```
- Check batch size (reduce if too large)
- Verify network stability
- Monitor server resources

**Data Validation Errors**
```
Skipped records: Title/content missing
```
- Review source data quality
- Check required fields
- Adjust validation rules if needed

### Performance Optimization

**Large Datasets**
- Use smaller batch sizes (10-25)
- Implement date range filtering
- Run during off-peak hours
- Monitor memory usage

**Slow Migration**
- Increase batch size (100-200)
- Check network latency
- Optimize MongoDB queries
- Use local Supabase instance

## 📊 Data Mapping

### MongoDB Post → Supabase News Article

| MongoDB Field | Supabase Field | Transformation |
|---------------|----------------|----------------|
| `_id` | `source_metadata.mongo_id` | String conversion |
| `title` | `title` | Direct mapping |
| `content.text` | `content` | HTML cleaning |
| `summary` | `summary` | Auto-generation if empty |
| `published_at` | `published_at` | Date normalization |
| `categories` | `source_metadata.categories` | Array preservation |
| `topics` | `source_metadata.topics` | Array preservation |
| `hit` | `source_metadata.hit_count` | Statistics mapping |

### Content Processing

1. **HTML Cleaning**: Remove `<script>`, `<style>`, and HTML tags
2. **Content Validation**: Minimum 50 characters, maximum 200 chars for title
3. **Summary Generation**: First 200 characters if no summary exists
4. **Status Filtering**: Only published posts (status = 1)

## 🚀 Next Steps

After successful migration:

1. **Phase 2**: Political analysis and language pattern extraction
2. **Phase 3**: Content generation with AI models
3. **Vector Integration**: Qdrant database setup for semantic search
4. **Analysis Pipeline**: Automated political stance detection

## 📈 Performance Metrics

### Expected Performance
- **Small Dataset** (< 1K records): 2-5 minutes
- **Medium Dataset** (1K-10K records): 10-30 minutes  
- **Large Dataset** (10K+ records): 1-4 hours
- **Processing Rate**: ~50-100 records/minute

### Resource Usage
- **Memory**: 50-200MB during migration
- **Network**: 1-10MB/minute depending on content size
- **CPU**: Low usage, I/O bound operation

## 🔒 Security Considerations

- Store MongoDB credentials securely
- Use read-only database users
- Validate all input data
- Sanitize HTML content
- Log access and operations
- Monitor for data integrity

## 📝 Changelog

### v1.0.0 - Initial Implementation
- MongoDB connection service
- ETL transformation pipeline  
- React migration interface
- API endpoints and Edge functions
- Documentation and testing tools 