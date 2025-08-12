# Deployment Guide - Cloudflare Pages

This guide covers deploying the CI Dashboard to Cloudflare Pages with the domain `dashboard.getcihq.com`.

## Prerequisites

1. **Cloudflare Account** with access to Pages
2. **Domain Registration** for `getcihq.com` (should be managed in Cloudflare)
3. **GitHub Repository** access for automated deployments

## Deployment Steps

### 1. Cloudflare Pages Setup

1. **Go to Cloudflare Dashboard** → Pages
2. **Connect to Git** → Select your GitHub repository
3. **Configure Build Settings**:
   - **Framework preset**: Next.js
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
   - **Root directory**: `ci-dashboard`
   - **Node.js version**: `18.17.0`

### 2. Environment Variables

In Cloudflare Pages → Settings → Environment variables, add:

```bash
# Required - Production URLs
NEXT_PUBLIC_APP_URL=https://dashboard.getcihq.com

# Required - Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://vznrzhawfqxytmasgzho.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI

# Optional - OpenAI API Key (if using direct OpenAI calls)
OPENAI_API_KEY=your-production-openai-key

# Optional - SuperMemory API Key
SUPERMEMORY_API_KEY=your-production-supermemory-key
```

### 3. Custom Domain Setup

1. **In Cloudflare Pages** → Custom domains
2. **Add custom domain**: `dashboard.getcihq.com`
3. **DNS will be automatically configured** if domain is in same Cloudflare account
4. **SSL certificate** will be automatically provisioned

### 4. Supabase Configuration Updates

In your Supabase dashboard, update:

**Authentication → URL Configuration:**
- Add `https://dashboard.getcihq.com` to **Site URL**
- Add `https://dashboard.getcihq.com` to **Redirect URLs**

**Authentication → Auth Providers:**
- Update any OAuth provider redirect URLs to include `https://dashboard.getcihq.com`

### 5. Extension Production Build

For production extension deployment:

1. **Update config.js**:
   ```javascript
   const WEB_DASHBOARD_URL = 'https://dashboard.getcihq.com';
   ```

2. **Build extension** and upload to Chrome Web Store

### 6. Build Commands Reference

**Local development:**
```bash
cd ci-dashboard
npm run dev
```

**Production build (Cloudflare):**
```bash
cd ci-dashboard
npm run build
npm run build:cloudflare  # For Cloudflare-specific build
```

**Local preview:**
```bash
cd ci-dashboard
npm run preview
```

## Post-Deployment Checklist

- [ ] Dashboard loads at `https://dashboard.getcihq.com`
- [ ] Supabase authentication works
- [ ] Extension can connect to production dashboard
- [ ] Content script detects auth on production domain
- [ ] API routes function correctly
- [ ] Environment variables are properly set

## Troubleshooting

**Build Failures:**
- Check Node.js version (should be 18.17.0+)
- Verify all dependencies are in package.json
- Check build logs for specific errors

**Authentication Issues:**
- Verify Supabase URLs in environment variables
- Check Supabase Auth URL configuration
- Ensure content script matches include production domain

**Domain Issues:**
- Verify DNS is pointing to Cloudflare Pages
- Check SSL certificate status
- Ensure custom domain is properly added in Pages settings

## Files Modified for Production

- `ci-dashboard/next.config.mjs` - Cloudflare compatibility
- `ci-dashboard/wrangler.toml` - Cloudflare configuration
- `ci-dashboard/.env.production` - Production environment variables
- `config.js` - Production dashboard URL (comment shows where to change)
- `content-auth.js` - Production domain matching
- `manifest.json` - Production domain permissions

## Security Notes

- Never commit production API keys to git
- Use Cloudflare Pages environment variables for secrets
- Supabase RLS policies should be properly configured
- Keep anon key public-facing (it's designed for client use)