import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get request body
    const { model, messages, max_tokens, temperature } = await req.json()

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid messages' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Helicone API key (optional). If missing, fall back to OpenAI direct.
    const heliconeApiKey = Deno.env.get('HELICONE_API_KEY')

    // Pick API URL based on Helicone availability
    const apiUrl = heliconeApiKey
      ? 'https://oai.helicone.ai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'

    // Prepare headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    }
    if (heliconeApiKey) {
      headers['Helicone-Auth'] = `Bearer ${heliconeApiKey}`
      headers['Helicone-User-Id'] = user.id
    }

    // Resolve model aliases and provide safe fallback for unsupported models
    const MODEL_ALIASES: Record<string, string> = {
      'gpt-5-mini': 'gpt-4o-mini',
      'gpt-5': 'gpt-4o',
    }
    const SUPPORTED_MODELS = new Set([
      'gpt-4o-mini',
      'gpt-4o',
      'o3-mini',
      'o3',
    ])
    const requestedModel = (model || '').trim()
    const effectiveModel = MODEL_ALIASES[requestedModel] || requestedModel || 'gpt-4o-mini'
    const finalModel = SUPPORTED_MODELS.has(effectiveModel) ? effectiveModel : 'gpt-4o-mini'

    // Make request to OpenAI
    const openaiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: finalModel,
        messages,
        max_tokens: max_tokens || 1000,
        temperature: temperature || 0.3,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API error', 
          details: errorText,
          status: openaiResponse.status,
          model_used: finalModel,
          requested_model: requestedModel,
        }),
        {
          status: openaiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await openaiResponse.json()

    // Return the response
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in openai-proxy function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})