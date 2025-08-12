import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    // During build time, environment variables might not be available
    // Return a dummy client to prevent build failures
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
      const dummyUrl = 'https://dummy.supabase.co'
      const dummyKey = 'dummy-key'
      cachedClient = createClient(dummyUrl, dummyKey)
      return cachedClient
    }
    
    const message = 'Supabase environment vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    throw new Error(message)
  }

  cachedClient = createClient(url, anon)
  return cachedClient
}


