// Configuration for AI services
const CONFIG = {
  OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
  HELICONE_BASE_URL: 'https://oai.helicone.ai/v1',
  DEFAULT_MODEL: 'gpt-5-mini', // Default to GPT-5 mini
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.3 // Lower temperature for more consistent analysis
};

// URL for external web dashboard
// For production, change this to 'https://dashboard.getcihq.com'
const WEB_DASHBOARD_URL = 'https://dashboard.getcihq.com';

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'openai_api_key',
  INITIAL_MODEL: 'initial_model',
  DEEP_MODEL: 'deep_model',
  COMPANY_CONTEXT: 'company_context',
  EXTRACTION_HISTORY: 'extraction_history',
  API_CALLS_TODAY: 'api_calls_today',
  API_CALLS_TOTAL: 'api_calls_total',
  LAST_USED: 'last_used',
  LAST_USED_DATE: 'last_used_date'
};

// Supabase configuration (set these in Options page via storage)
const SUPABASE_STORAGE_KEYS = {
  URL: 'supabase_url',
  ANON_KEY: 'supabase_anon_key'
};

// Hardcoded Supabase defaults
const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';

// Minimal Supabase REST helpers (no external libs; uses fetch)
// Hard-lock to project defaults: ignores any user-configured values.
async function getSupabaseConfig() {
  return {
    url: SUPABASE_DEFAULT_URL,
    anonKey: SUPABASE_DEFAULT_ANON_KEY
  };
}

function buildSupabaseHeaders(accessTokenOrAnonKey) {
  return {
    'apikey': accessTokenOrAnonKey,
    'Authorization': `Bearer ${accessTokenOrAnonKey}`,
    'Content-Type': 'application/json'
  };
}

// Helicone helpers
async function getHeliconeConfig() {
  try {
    const { helicone_enabled, helicone_api_key } = await chrome.storage.sync.get(['helicone_enabled', 'helicone_api_key']);
    return { enabled: !!helicone_enabled, apiKey: helicone_api_key || '' };
  } catch (_) {
    return { enabled: false, apiKey: '' };
  }
}

// Exchange tokens: setSession equivalent using Auth v2 REST
async function supabaseSetSession({ access_token, refresh_token }) {
  // This mirrors client behavior by storing session for later reuse
  const session = {
    access_token,
    refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 // optimistic 1h
  };
  await chrome.storage.local.set({ session });
  return { data: { session }, error: null };
}

// Get current session from storage
async function getSupabaseSession() {
  const { session } = await chrome.storage.local.get('session');
  return session || null;
}

// Fetch current user using access token
async function supabaseGetUser() {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  if (!cfg.url || !cfg.anonKey || !session?.access_token) return { data: null, error: new Error('Not authenticated') };
  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: buildSupabaseHeaders(session.access_token)
  });
  if (!res.ok) return { data: null, error: new Error('Failed to fetch user') };
  return { data: await res.json(), error: null };
}

// Example DB insert via REST (postgrest)
async function supabaseInsert(table, rows) {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  const token = session?.access_token || cfg.anonKey;
  const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...buildSupabaseHeaders(token),
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${txt}`);
  }
  return await res.json();
}

function buildSupabaseAuthorizeUrl(provider, redirectUrl) {
  return getSupabaseConfig().then(({ url }) => {
    if (!url) throw new Error('Supabase URL not configured');
    const authorize = new URL(`${url}/auth/v1/authorize`);
    authorize.searchParams.set('provider', provider);
    authorize.searchParams.set('redirect_to', redirectUrl);
    return authorize.toString();
  });
}

async function supabaseLogout() {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  try {
    if (cfg.url && cfg.anonKey && session?.access_token) {
      await fetch(`${cfg.url}/auth/v1/logout`, {
        method: 'POST',
        headers: buildSupabaseHeaders(session.access_token)
      });
    }
  } catch (_) {
    // ignore
  }
  await chrome.storage.local.remove('session');
}

// -------- Email/Password Auth --------
async function supabaseSignInWithPassword(email, password) {
  const cfg = await getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase not configured');
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || 'Sign-in failed');
  }
  if (!data.access_token || !data.refresh_token) {
    throw new Error('No tokens returned from sign-in');
  }
  await supabaseSetSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  return data;
}

async function supabaseSignUpWithPassword(email, password) {
  const cfg = await getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase not configured');
  const res = await fetch(`${cfg.url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.msg || data?.error_description || data?.error || 'Sign-up failed');
  }
  // If email confirmation is disabled, tokens may be returned
  if (data.access_token && data.refresh_token) {
    await supabaseSetSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  }
  return data;
}

// Send magic link (passwordless) to email
async function supabaseSendMagicLink(email, redirectUrl) {
  const cfg = await getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase not configured');
  const res = await fetch(`${cfg.url}/auth/v1/otp`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, create_user: true, type: 'magiclink', redirect_to: redirectUrl })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.msg || data?.error_description || data?.error || 'Failed to send magic link');
  }
  return true;
}

// Send a one-time passcode (OTP) to the user's email
async function supabaseSendEmailOtp(email) {
  const cfg = await getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase not configured');
  // Sending to /otp will trigger the email template. To use a numeric code instead
  // of a magic link, ensure your Supabase "Magic Link" template includes {{ .Token }}.
  const res = await fetch(`${cfg.url}/auth/v1/otp`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      'Content-Type': 'application/json'
    },
    // create_user: true mirrors supabase-js default; omit redirect_to for code flow
    body: JSON.stringify({ email, create_user: true })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.msg || data?.error_description || data?.error || 'Failed to send code');
  }
  return true;
}

// Verify email OTP and establish a session
async function supabaseVerifyEmailOtp(email, token) {
  const cfg = await getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase not configured');
  const res = await fetch(`${cfg.url}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      'Content-Type': 'application/json'
    },
    // Include verification type in the body as required by the API
    body: JSON.stringify({ type: 'email', email, token })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.msg || data?.error_description || data?.error || 'Invalid or expired code');
  }
  if (!data.access_token || !data.refresh_token) {
    throw new Error('No session returned from verification');
  }
  await supabaseSetSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  return data;
}

// -------- Analysis Storage Functions --------

// Save analysis to Supabase database
async function saveAnalysisToSupabase(analysisData) {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  
  if (!cfg.url || !cfg.anonKey) {
    throw new Error('Supabase not configured');
  }
  
  if (!session?.access_token) {
    throw new Error('User not authenticated');
  }

  // Get current user to ensure we have user_id
  const userResponse = await supabaseGetUser();
  if (!userResponse.data) {
    throw new Error('Unable to get current user');
  }

  // Prepare analysis data for database
  const analysis = {
    user_id: userResponse.data.id,
    title: analysisData.title || analysisData.pageData?.title || 'Untitled Analysis',
    url: analysisData.url || analysisData.pageData?.url,
    domain: analysisData.domain || extractDomainFromUrl(analysisData.url || analysisData.pageData?.url),
    analysis_type: determineAnalysisType(analysisData.report || analysisData.content),
    content: analysisData.report || analysisData.content,
    page_data: analysisData.pageData,
    model_used: analysisData.model_used || await getInitialModel(),
    token_count: estimateTokenCount(analysisData.report || analysisData.content),
    tags: analysisData.tags || [],
    category: analysisData.category || null,
    is_favorite: analysisData.is_favorite || false
  };

  const token = session.access_token;
  const res = await fetch(`${cfg.url}/rest/v1/analyses`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(analysis)
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to save analysis: ${res.status} ${error}`);
  }

  return await res.json();
}

// Retrieve user's analyses from Supabase
async function getUserAnalyses(options = {}) {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  
  if (!cfg.url || !cfg.anonKey || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }

  // Build query parameters
  const queryParams = new URLSearchParams();
  
  // Ordering
  if (options.orderBy) {
    queryParams.append('order', `${options.orderBy}.${options.order || 'desc'}`);
  } else {
    queryParams.append('order', 'created_at.desc');
  }
  
  // Limit
  if (options.limit) {
    queryParams.append('limit', options.limit);
  }
  
  // Filtering
  if (options.domain) {
    queryParams.append('domain', `eq.${options.domain}`);
  }
  
  if (options.analysis_type) {
    queryParams.append('analysis_type', `eq.${options.analysis_type}`);
  }
  
  if (options.is_favorite) {
    queryParams.append('is_favorite', `eq.true`);
  }
  
  // Search in title or content
  if (options.search) {
    queryParams.append('or', `title.ilike.%${options.search}%,content.ilike.%${options.search}%`);
  }

  const token = session.access_token;
  const url = `${cfg.url}/rest/v1/analyses?${queryParams.toString()}`;
  
  const res = await fetch(url, {
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to retrieve analyses: ${res.status} ${error}`);
  }

  return await res.json();
}

// Get single analysis by ID
async function getAnalysisById(id) {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  
  if (!cfg.url || !cfg.anonKey || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }

  const token = session.access_token;
  const res = await fetch(`${cfg.url}/rest/v1/analyses?id=eq.${id}`, {
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to retrieve analysis: ${res.status} ${error}`);
  }

  const results = await res.json();
  return results.length > 0 ? results[0] : null;
}

// Update analysis (for tags, category, favorite status, etc.)
async function updateAnalysis(id, updates) {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  
  if (!cfg.url || !cfg.anonKey || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }

  // Only allow certain fields to be updated
  const allowedUpdates = {
    tags: updates.tags,
    category: updates.category,
    is_favorite: updates.is_favorite
  };

  // Remove undefined values
  const cleanUpdates = Object.fromEntries(
    Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
  );

  if (Object.keys(cleanUpdates).length === 0) {
    throw new Error('No valid updates provided');
  }

  const token = session.access_token;
  const res = await fetch(`${cfg.url}/rest/v1/analyses?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(cleanUpdates)
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to update analysis: ${res.status} ${error}`);
  }

  return await res.json();
}

// Delete analysis
async function deleteAnalysis(id) {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  
  if (!cfg.url || !cfg.anonKey || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }

  const token = session.access_token;
  const res = await fetch(`${cfg.url}/rest/v1/analyses?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to delete analysis: ${res.status} ${error}`);
  }

  return true;
}

// Get user's analysis summary/stats
async function getUserAnalysisStats() {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  
  if (!cfg.url || !cfg.anonKey || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }

  const token = session.access_token;
  const res = await fetch(`${cfg.url}/rest/v1/user_analysis_summary`, {
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to retrieve stats: ${res.status} ${error}`);
  }

  const results = await res.json();
  return results.length > 0 ? results[0] : null;
}

// Helper functions
function extractDomainFromUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function determineAnalysisType(content) {
  if (!content) return 'general';
  
  const contentLower = content.toLowerCase();
  
  // Check for pricing indicators
  if (contentLower.includes('pricing') || 
      contentLower.includes('plan') && contentLower.includes('price') ||
      contentLower.includes('subscription') ||
      contentLower.includes('billing')) {
    return 'pricing_analysis';
  }
  
  // Check for feature indicators
  if (contentLower.includes('feature') || 
      contentLower.includes('capability') ||
      contentLower.includes('functionality')) {
    return 'feature_extraction';
  }
  
  return 'general';
}

function estimateTokenCount(text) {
  if (!text) return 0;
  // Rough estimation: 4 characters per token on average
  return Math.ceil(text.length / 4);
}

// Get initial model setting
async function getInitialModel() {
  try {
    const result = await chrome?.storage?.sync.get(['initial_model']);
    return result?.initial_model || CONFIG.DEFAULT_MODEL;
  } catch (e) {
    return CONFIG.DEFAULT_MODEL;
  }
}

// Call OpenAI API via Supabase Edge Function (secure)
async function callOpenAIViaEdgeFunction({ model, messages, max_tokens, temperature }) {
  const cfg = await getSupabaseConfig();
  const session = await getSupabaseSession();
  
  if (!cfg.url) {
    throw new Error('Supabase not configured. Please check your settings.');
  }
  
  if (!session?.access_token) {
    throw new Error('Please log in to your account to use AI features. Click the dashboard to sign in.');
  }
  
  const edgeFunctionUrl = `${cfg.url}/functions/v1/openai-proxy`;
  
  console.log('Calling Edge Function:', {
    url: edgeFunctionUrl,
    hasToken: !!session?.access_token,
    payload: { model, messages: messages?.length, max_tokens, temperature }
  });
  
  // Resolve model aliases on client too, so older deployed functions still work
  const MODEL_ALIASES = {
    'gpt-5-mini': 'gpt-4o-mini',
    'gpt-5': 'gpt-4o',
  };
  const SUPPORTED_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o3']);
  const requestedModel = (model || '').trim();
  const effectiveModel = MODEL_ALIASES[requestedModel] || requestedModel || CONFIG.DEFAULT_MODEL;
  const finalModel = SUPPORTED_MODELS.has(effectiveModel) ? effectiveModel : CONFIG.DEFAULT_MODEL;

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: finalModel,
      messages,
      max_tokens: max_tokens || CONFIG.MAX_TOKENS,
      temperature: temperature || CONFIG.TEMPERATURE
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    let parsed;
    try { parsed = JSON.parse(errorText); } catch (_) { parsed = null; }
    console.error('Edge Function Error Details:', parsed || errorText);
    const msg = parsed?.error || parsed?.message || parsed?.details || errorText || 'Request failed';
    const detailSuffix = parsed?.model_used ? ` [requested: ${requestedModel || 'n/a'}, used: ${parsed.model_used}]` : '';
    throw new Error(`Edge Function Error (${response.status}): ${msg}${detailSuffix}`);
  }

  return await response.json();
}