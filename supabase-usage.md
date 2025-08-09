# Supabase Integration for CI Feature Extractor

This document explains how to set up and use the Supabase integration for storing and retrieving user analyses.

## Setup

### 1. Database Setup

1. Create a new Supabase project
2. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor
3. Configure Row Level Security (RLS) and authentication as needed

### 2. Environment Configuration

Add your Supabase configuration to the extension's storage (via options page):

```javascript
// These will be stored in chrome.storage.sync
{
  supabase_url: 'https://your-project.supabase.co',
  supabase_anon_key: 'your-anon-key'
}
```

### 3. Authentication

The extension uses magic link authentication. Users can authenticate via:
- Magic link sent to email
- OAuth providers (if configured)

## Usage

### Auto-Save Analyses

Analyses are automatically saved to Supabase after completion if the user is authenticated. This happens in the background without user intervention.

### Manual Operations

You can also manually save, retrieve, and manage analyses using the provided functions:

#### Save Analysis

```javascript
// From popup/dashboard context (using config.js functions)
const analysisData = {
  pageData: { /* page data object */ },
  report: "Analysis report content",
  url: "https://example.com",
  model_used: "gpt-4o-mini"
};

const saved = await saveAnalysisToSupabase(analysisData);
console.log('Saved analysis:', saved[0]);
```

#### Retrieve Analyses

```javascript
// Get all user analyses
const analyses = await getUserAnalyses();

// Get with filtering/options
const filteredAnalyses = await getUserAnalyses({
  limit: 10,
  domain: 'example.com',
  analysis_type: 'pricing_analysis',
  search: 'features',
  orderBy: 'created_at',
  order: 'desc'
});

// From background script context
chrome.runtime.sendMessage(
  { type: 'getUserAnalyses', options: { limit: 10 } },
  (response) => {
    if (response.success) {
      console.log('Analyses:', response.result);
    }
  }
);
```

#### Update Analysis

```javascript
// Update tags, category, or favorite status
const updated = await updateAnalysis(analysisId, {
  tags: ['competitor', 'pricing'],
  category: 'saas-tools',
  is_favorite: true
});
```

#### Delete Analysis

```javascript
await deleteAnalysis(analysisId);
```

## Database Schema

### analyses table

- `id`: UUID primary key
- `user_id`: References auth.users(id) 
- `title`: Analysis title (from page title)
- `url`: Source URL
- `domain`: Extracted domain name
- `analysis_type`: 'feature_extraction', 'pricing_analysis', or 'general'
- `content`: Full analysis report
- `page_data`: JSONB with original page data
- `created_at`, `updated_at`: Timestamps
- `tags`: Array of user-defined tags
- `category`: User-defined category
- `is_favorite`: Boolean favorite flag
- `model_used`: OpenAI model used
- `token_count`: Estimated token count

### analysis_sessions table

For grouping analyses into projects/sessions:

- `id`: UUID primary key
- `user_id`: References auth.users(id)
- `name`: Session name
- `description`: Optional description
- `created_at`, `updated_at`: Timestamps

### session_analyses table

Junction table linking analyses to sessions:

- `session_id`: References analysis_sessions(id)
- `analysis_id`: References analyses(id)
- `added_at`: Timestamp

## Security

- Row Level Security (RLS) is enabled on all tables
- Users can only access their own data
- Authentication required for all operations
- API keys and tokens are stored securely in Chrome storage

## API Endpoints

The integration uses Supabase REST API endpoints:

- `POST /rest/v1/analyses` - Create analysis
- `GET /rest/v1/analyses` - List analyses (with filtering)
- `PATCH /rest/v1/analyses?id=eq.{id}` - Update analysis
- `DELETE /rest/v1/analyses?id=eq.{id}` - Delete analysis
- `GET /rest/v1/user_analysis_summary` - Get user statistics

## Error Handling

All functions include proper error handling:

- Authentication errors
- Network errors  
- Supabase API errors
- Invalid data errors

Errors are logged to console and can be handled by calling code.

## Example Integration in Dashboard

```html
<!-- In dashboard HTML -->
<script>
// Load user's saved analyses
async function loadSavedAnalyses() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'getUserAnalyses', options: { limit: 20 } },
        resolve
      );
    });
    
    if (response.success) {
      displayAnalyses(response.result);
    } else {
      console.error('Failed to load analyses:', response.error);
    }
  } catch (error) {
    console.error('Error loading analyses:', error);
  }
}

function displayAnalyses(analyses) {
  const container = document.getElementById('saved-analyses');
  container.innerHTML = analyses.map(analysis => `
    <div class="analysis-card">
      <h3>${analysis.title}</h3>
      <p><strong>Domain:</strong> ${analysis.domain}</p>
      <p><strong>Type:</strong> ${analysis.analysis_type}</p>
      <p><strong>Date:</strong> ${new Date(analysis.created_at).toLocaleDateString()}</p>
      <div class="tags">
        ${analysis.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>
      <button onclick="viewAnalysis('${analysis.id}')">View</button>
      <button onclick="toggleFavorite('${analysis.id}', ${!analysis.is_favorite})">
        ${analysis.is_favorite ? '★' : '☆'}
      </button>
    </div>
  `).join('');
}
</script>
```

This integration provides a complete solution for persistent storage of competitive intelligence analyses with user authentication and data organization features.