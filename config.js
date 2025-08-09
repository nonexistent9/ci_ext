// Configuration for AI services
const CONFIG = {
  OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
  DEFAULT_MODEL: 'gpt-4o-mini', // Cost-effective model for feature extraction
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.3 // Lower temperature for more consistent analysis
};

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

// Minimal Supabase REST helpers (no external libs; uses fetch)
async function getSupabaseConfig() {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get([
    SUPABASE_STORAGE_KEYS.URL,
    SUPABASE_STORAGE_KEYS.ANON_KEY
  ].map((k) => k));
  return {
    url: supabase_url,
    anonKey: supabase_anon_key
  };
}

function buildSupabaseHeaders(accessTokenOrAnonKey) {
  return {
    'apikey': accessTokenOrAnonKey,
    'Authorization': `Bearer ${accessTokenOrAnonKey}`,
    'Content-Type': 'application/json'
  };
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