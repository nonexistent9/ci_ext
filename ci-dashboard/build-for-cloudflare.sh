#!/bin/bash

# Build script for Cloudflare Pages deployment

echo "🚀 Building CI Dashboard for Cloudflare Pages..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run Next.js build
echo "🔨 Building Next.js application..."
npm run build

# Run Cloudflare Pages build
echo "☁️ Preparing for Cloudflare Pages..."
npm run build:cloudflare

echo "✅ Build complete! Ready for Cloudflare Pages deployment."
echo ""
echo "Next steps:"
echo "1. Push to GitHub repository"
echo "2. Connect repository to Cloudflare Pages"
echo "3. Set environment variables in Cloudflare Dashboard"
echo "4. Deploy!"