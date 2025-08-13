#!/bin/bash

# Complete packaging script for CI HQ Extension
echo "🚀 Creating complete CI HQ Extension package..."

# Create the final package directory
PACKAGE_DIR="ci-hq-extension-final"
rm -rf $PACKAGE_DIR
mkdir $PACKAGE_DIR

# Copy all necessary files
echo "📁 Copying extension files..."
cp manifest.json $PACKAGE_DIR/
cp popup.html $PACKAGE_DIR/
cp popup.js $PACKAGE_DIR/
cp background.js $PACKAGE_DIR/
cp config.js $PACKAGE_DIR/
cp content-auth.js $PACKAGE_DIR/

# Create public directory
mkdir -p $PACKAGE_DIR/public

# Create a simple HTML-based icon as placeholder
cat > $PACKAGE_DIR/icon_placeholder.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>CI HQ Icon</title></head>
<body style="margin:0; background:#4F46E5; display:flex; align-items:center; justify-content:center; width:128px; height:128px;">
  <div style="background:white; border-radius:50%; width:80px; height:80px; display:flex; align-items:center; justify-content:center; font-family:Arial; font-size:24px; font-weight:bold; color:#4F46E5;">
    CI
  </div>
</body>
</html>
EOF

# Create README for the package
cat > $PACKAGE_DIR/README.txt << 'EOF'
CI HQ Chrome Extension Package
==============================

FILES INCLUDED:
- manifest.json     - Extension configuration
- popup.html        - Extension popup interface  
- popup.js          - Popup functionality
- background.js     - Background service worker
- config.js         - Configuration and API handling
- content-auth.js   - Authentication content script
- public/           - Directory for icons (empty - needs icons)

MISSING ICONS:
You need to add these PNG icon files to the public/ directory:
- public/icon16.png  (16x16 pixels)
- public/icon48.png  (48x48 pixels)  
- public/icon128.png (128x128 pixels)

INSTALLATION:
1. Add the icon files mentioned above
2. Go to chrome://extensions/
3. Enable "Developer mode" 
4. Click "Load unpacked"
5. Select this folder

OR for Chrome Web Store:
1. Add the icon files
2. Zip the entire folder
3. Upload to Chrome Web Store Developer Console

BRANDING:
Use CI HQ themed icons with your brand colors.
Consider using a target 🎯 or similar competitive intelligence imagery.

Version: 1.0.0
Author: CI HQ
Homepage: https://dashboard.getcihq.com
EOF

echo "📦 Creating ZIP file..."
cd $PACKAGE_DIR
zip -r ../ci-hq-extension-complete.zip .
cd ..

# Create a development version with icons note
cat > install-instructions.md << 'EOF'
# CI HQ Extension Installation

## 🎯 Your Extension Package is Ready!

### Files Created:
- `ci-hq-extension-complete.zip` - Complete package for Chrome Web Store
- `ci-hq-extension-final/` - Unpacked folder for development

### ⚠️ Before Installing:
You need to add icon files to make the extension work properly:

1. **Create Icons** (PNG format):
   - `public/icon16.png` - 16x16 pixels
   - `public/icon48.png` - 48x48 pixels  
   - `public/icon128.png` - 128x128 pixels

2. **Icon Design Ideas**:
   - CI HQ logo
   - Target 🎯 symbol
   - Competitive intelligence themed
   - Blue/purple color scheme

### 🔧 Development Installation:
1. Add icon files to `ci-hq-extension-final/public/`
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `ci-hq-extension-final` folder

### 📤 Chrome Web Store:
1. Add icon files
2. Update the ZIP file  
3. Upload `ci-hq-extension-complete.zip` to Chrome Web Store

### 🎉 Ready to Rock!
Your CI HQ extension is packaged and ready to help users dominate their competitive intelligence game!
EOF

echo "✅ Complete package created!"
echo ""
echo "📁 Files created:"
echo "   - ci-hq-extension-complete.zip (for Chrome Web Store)"
echo "   - ci-hq-extension-final/ (development folder)"
echo "   - install-instructions.md (setup guide)"
echo ""
echo "⚠️  Don't forget to add icon files before installing!"
echo "🎯 Your CI HQ extension is ready to dominate the market!"