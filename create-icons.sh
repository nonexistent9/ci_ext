#!/bin/bash

# Create basic icon placeholders for CI HQ Extension
echo "🎨 Creating icon placeholders for CI HQ Extension..."

# Create public directory if it doesn't exist
mkdir -p public

# Create a simple SVG icon and convert to different sizes
cat > temp_icon.svg << 'EOF'
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#4F46E5"/>
  <circle cx="64" cy="64" r="40" fill="white"/>
  <text x="64" y="75" font-family="Arial" font-size="32" fill="#4F46E5" text-anchor="middle">CI</text>
</svg>
EOF

# If you have ImageMagick installed, this will work
if command -v convert >/dev/null 2>&1; then
    echo "📐 Converting SVG to PNG icons..."
    convert temp_icon.svg -resize 16x16 public/icon16.png
    convert temp_icon.svg -resize 48x48 public/icon48.png  
    convert temp_icon.svg -resize 128x128 public/icon128.png
    echo "✅ Icons created successfully!"
else
    echo "⚠️  ImageMagick not found. Please create these icons manually:"
    echo "   - public/icon16.png (16x16)"
    echo "   - public/icon48.png (48x48)"
    echo "   - public/icon128.png (128x128)"
    echo ""
    echo "🎯 Icon should be CI HQ themed with your branding"
fi

# Clean up
rm -f temp_icon.svg

echo "🎨 Icon creation complete!"