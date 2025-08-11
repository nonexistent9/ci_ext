# Supabase Edge Function Setup for Secure API Key Management

This guide shows how to deploy the Supabase Edge Function to securely handle OpenAI API calls without exposing your API key to users.

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Supabase project created
- OpenAI API key

## Setup Steps

### 1. Deploy the Edge Function

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy openai-proxy --no-verify-jwt
```

### 2. Set Environment Variables

In your Supabase dashboard, go to Project Settings → Edge Functions and set:

- `OPENAI_API_KEY`: Your OpenAI API key
- `HELICONE_API_KEY`: Your Helicone API key (required for routing and monitoring)

### 3. Update Browser Extension

The extension code has been updated to:
- Call the Edge Function instead of OpenAI directly
- Require user authentication via Supabase
- Remove OpenAI API key storage from the extension

### 4. User Flow

1. Users must log in to your Supabase project
2. The extension sends requests to your Edge Function
3. The Edge Function uses your server-side OpenAI API key
4. Responses are returned to the authenticated user

## Benefits

✅ **Security**: API key never leaves your server  
✅ **Control**: You manage access via user authentication  
✅ **Monitoring**: All requests tracked via Helicone  
✅ **Scalable**: Handles multiple users without key sharing  
✅ **Analytics**: Per-user tracking with Helicone-User-Id

## Testing

After deployment, test with:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/openai-proxy' \
  -H 'Authorization: Bearer YOUR_USER_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

Replace `YOUR_PROJECT_REF` and `YOUR_USER_ACCESS_TOKEN` with actual values.