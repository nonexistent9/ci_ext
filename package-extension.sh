#!/bin/bash

# CI Feature Extractor - Extension Packaging Script
# This script creates a clean package for distribution

echo "📦 Packaging CI Feature Extractor..."

# Create package directory
PACKAGE_DIR="extension-package"
ZIP_NAME="ci-feature-extractor-v1.0.zip"

# Clean up existing package
rm -rf "$PACKAGE_DIR"
rm -f "$ZIP_NAME"

# Create package directory
mkdir "$PACKAGE_DIR"

# Copy essential extension files
echo "📋 Copying essential files..."
cp manifest.json "$PACKAGE_DIR/"
cp background.js "$PACKAGE_DIR/"
cp popup.html "$PACKAGE_DIR/"
cp popup.js "$PACKAGE_DIR/"
cp content.js "$PACKAGE_DIR/"
cp config.js "$PACKAGE_DIR/"
cp dashboard-new.html "$PACKAGE_DIR/"
cp dashboard-new.js "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/"
cp LICENSE "$PACKAGE_DIR/"

# Copy documentation
cp EDGE-FUNCTION-SETUP.md "$PACKAGE_DIR/"
cp SUPABASE-SETUP.md "$PACKAGE_DIR/"

# Create ZIP package
echo "🗜️ Creating ZIP package..."
cd "$PACKAGE_DIR"
zip -r "../$ZIP_NAME" *
cd ..

# Clean up temporary directory
rm -rf "$PACKAGE_DIR"

echo "✅ Package created: $ZIP_NAME"
echo "📊 Package size: $(du -h "$ZIP_NAME" | cut -f1)"
echo ""
echo "Distribution options:"
echo "1. Chrome Web Store: Upload $ZIP_NAME"
echo "2. GitHub Release: Attach $ZIP_NAME to release"
echo "3. Direct sharing: Send $ZIP_NAME to users"