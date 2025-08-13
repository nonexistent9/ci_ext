#!/bin/bash

# CI HQ Chrome Extension Packaging Script
# This script packages your extension for Chrome Web Store submission

echo "🎯 Packaging CI HQ Extension for Chrome Web Store..."

# Create a temporary directory for packaging
PACKAGE_DIR="ci-hq-extension-package"
rm -rf $PACKAGE_DIR
mkdir $PACKAGE_DIR

# Copy essential files
echo "📁 Copying extension files..."
cp manifest.json $PACKAGE_DIR/
cp popup.html $PACKAGE_DIR/
cp popup.js $PACKAGE_DIR/
cp background.js $PACKAGE_DIR/
cp config.js $PACKAGE_DIR/
cp content-auth.js $PACKAGE_DIR/

# Create public directory for icons
mkdir -p $PACKAGE_DIR/public

# Copy icons if they exist, otherwise create placeholders
if [ -f "public/icon16.png" ]; then
    cp public/icon*.png $PACKAGE_DIR/public/
else
    echo "⚠️  Warning: Icon files not found. You'll need to add:"
    echo "   - public/icon16.png (16x16)"
    echo "   - public/icon48.png (48x48)" 
    echo "   - public/icon128.png (128x128)"
fi

# Remove localhost references for production
echo "🔧 Preparing for production..."
sed -i.bak 's/http:\/\/localhost:\*\/\*//' $PACKAGE_DIR/manifest.json
rm $PACKAGE_DIR/manifest.json.bak 2>/dev/null || true

# Create ZIP file
ZIP_NAME="ci-hq-extension-v1.0.0.zip"
echo "📦 Creating ZIP package: $ZIP_NAME"
cd $PACKAGE_DIR
zip -r ../$ZIP_NAME .
cd ..

# Cleanup
rm -rf $PACKAGE_DIR

echo "✅ Package created: $ZIP_NAME"
echo ""
echo "📋 Next steps:"
echo "1. Create icon files (16x16, 48x48, 128x128 PNG)"
echo "2. Take screenshots of your extension in action"
echo "3. Write a privacy policy"
echo "4. Go to https://chrome.google.com/webstore/devconsole"
echo "5. Upload $ZIP_NAME"
echo ""
echo "🎉 Your extension is ready for the Chrome Web Store!"