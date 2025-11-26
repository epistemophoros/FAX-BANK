#!/bin/bash

# Foundry VTT Module - Link Script
# Creates a symlink from dist/ to Foundry's modules folder for development

set -e

MODULE_ID="example-module"

echo "🔗 Foundry VTT Module Linker"
echo ""

# Check for dist folder
if [ ! -d "dist" ]; then
    echo "⚠️  No dist/ folder found. Building module first..."
    npm run build
fi

# Detect OS and set default paths
case "$(uname -s)" in
    Darwin*)
        DEFAULT_PATH="$HOME/Library/Application Support/FoundryVTT/Data/modules"
        ;;
    Linux*)
        DEFAULT_PATH="$HOME/.local/share/FoundryVTT/Data/modules"
        ;;
    MINGW*|CYGWIN*|MSYS*)
        DEFAULT_PATH="$LOCALAPPDATA/FoundryVTT/Data/modules"
        ;;
    *)
        DEFAULT_PATH=""
        ;;
esac

# Ask for Foundry data path
echo "Enter your Foundry VTT Data/modules path"
if [ -n "$DEFAULT_PATH" ]; then
    echo "(Press Enter to use: $DEFAULT_PATH)"
fi
read -r FOUNDRY_PATH

if [ -z "$FOUNDRY_PATH" ]; then
    FOUNDRY_PATH="$DEFAULT_PATH"
fi

# Validate path
if [ ! -d "$FOUNDRY_PATH" ]; then
    echo "❌ Directory does not exist: $FOUNDRY_PATH"
    echo "Please ensure Foundry VTT is installed and the path is correct."
    exit 1
fi

LINK_PATH="$FOUNDRY_PATH/$MODULE_ID"
SOURCE_PATH="$(pwd)/dist"

# Check if link already exists
if [ -L "$LINK_PATH" ]; then
    echo "⚠️  Symlink already exists at $LINK_PATH"
    read -p "Remove and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$LINK_PATH"
    else
        echo "Exiting..."
        exit 0
    fi
elif [ -d "$LINK_PATH" ]; then
    echo "❌ A directory already exists at $LINK_PATH"
    echo "Please remove it manually if you want to create a symlink."
    exit 1
fi

# Create symlink
echo "Creating symlink..."
ln -s "$SOURCE_PATH" "$LINK_PATH"

echo ""
echo "✅ Symlink created successfully!"
echo "   Source: $SOURCE_PATH"
echo "   Target: $LINK_PATH"
echo ""
echo "📝 Development workflow:"
echo "   1. Run 'npm run dev' to start watch mode"
echo "   2. Changes will auto-build to dist/"
echo "   3. Refresh Foundry VTT to see changes"

