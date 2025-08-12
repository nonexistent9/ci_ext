# Vercel Deployment Guide

Deploy the CI Dashboard to Vercel with custom domain `dashboard.getcihq.com`.

## 🚀 Quick Deploy

### Method 1: Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign in with GitHub
2. **Click "New Project"** 
3. **Import Repository**: Select `nonexistent9/ci_ext`
4. **Configure Settings**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `ci-dashboard`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
5. **Click "Deploy"**

### Method 2: Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Navigate to dashboard directory
cd ci-dashboard

# Deploy
vercel

# For production deployment
vercel --prod
```

## ⚙️ Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://dashboard.getcihq.com` | Production |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vznrzhawfqxytmasgzho.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | All |

## 🌐 Custom Domain Setup

1. **In Vercel Project Dashboard**:
   - Go to **Settings** → **Domains**
   - Add domain: `dashboard.getcihq.com`

2. **DNS Configuration**:
   - **If domain is with Vercel**: Automatic configuration
   - **If domain is elsewhere**: Add CNAME record:
     ```
     dashboard.getcihq.com → cname.vercel-dns.com
     ```

3. **SSL Certificate**: Automatically provisioned by Vercel

## 🔧 Project Structure

```
ci_ext/
├── ci-dashboard/          # Next.js app (deployed)
│   ├── src/
│   ├── package.json
│   ├── next.config.mjs
│   └── vercel.json        # Vercel configuration
├── background.js          # Extension files
├── popup.js
├── manifest.json
└── config.js             # Update WEB_DASHBOARD_URL for production
```

## 📋 Post-Deployment Checklist

- [ ] Dashboard loads at `https://dashboard.getcihq.com`
- [ ] Supabase authentication works
- [ ] API routes respond correctly
- [ ] Extension connects to production URL
- [ ] Environment variables are set correctly

## 🔄 Automatic Deployments

Vercel automatically deploys:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

## ⚡ Optimization

Vercel automatically provides:
- **Edge Network**: Global CDN
- **Image Optimization**: Next.js Image component
- **API Routes**: Serverless functions
- **Analytics**: Performance insights

## 🐛 Troubleshooting

**Build Errors:**
- Check build logs in Vercel dashboard
- Verify Node.js version compatibility
- Ensure all dependencies are in package.json

**Domain Issues:**
- Verify DNS propagation (can take up to 48 hours)
- Check domain configuration in Vercel settings
- Ensure CNAME points to correct Vercel endpoint

**API Issues:**
- Check environment variables are set for production
- Verify Supabase URLs and keys
- Check function logs in Vercel dashboard

## 🎯 Production Extension Update

After successful deployment, update extension for production:

1. **Edit `config.js`**:
   ```javascript
   const WEB_DASHBOARD_URL = 'https://dashboard.getcihq.com';
   ```

2. **Update Supabase Auth URLs**:
   - Add `https://dashboard.getcihq.com` to Supabase Auth settings
   - Update redirect URLs in Supabase dashboard

3. **Test extension** with production dashboard
4. **Publish to Chrome Web Store**

## 📞 Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **Deployment Issues**: Check Vercel dashboard function logs