#!/bin/bash

# 🚀 Package CI HQ Extension for Chrome Web Store
echo "📦 Packaging CI HQ Extension for Chrome Web Store..."

# Get version from manifest.json
VERSION=$(grep -o '"version": "[^"]*' manifest.json | grep -o '[^"]*$')
PACKAGE_NAME="ci-hq-extension-v${VERSION}.zip"

# Clean up any existing package
rm -f *.zip

# Create temporary directory for packaging
TEMP_DIR="ci_ext_package"
rm -rf $TEMP_DIR
mkdir $TEMP_DIR

# Copy essential extension files
echo "📋 Copying extension files..."
cp manifest.json $TEMP_DIR/
cp background.js $TEMP_DIR/
cp popup.html $TEMP_DIR/
cp popup.js $TEMP_DIR/
cp content-auth.js $TEMP_DIR/
cp config.js $TEMP_DIR/

# Copy public directory (icons)
cp -r public $TEMP_DIR/

# Create the ZIP package
echo "📦 Creating ZIP package: $PACKAGE_NAME"
cd $TEMP_DIR
zip -r "../$PACKAGE_NAME" .
cd ..

# Clean up temporary directory
rm -rf $TEMP_DIR

echo "✅ Package created: $PACKAGE_NAME"
echo "🎯 Ready for Chrome Web Store upload!"
echo ""
echo "Next steps:"
echo "1. Go to Chrome Web Store Developer Console"
echo "2. Upload $PACKAGE_NAME"
echo "3. Fill out store listing with details from CHROME-WEBSTORE-GUIDE.md"