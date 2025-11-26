#!/bin/bash

# FAX-BANK - Git Setup Script
# This script initializes the git repository with main and development branches

set -e

echo "🎮 Setting up FAX-BANK Repository..."
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    exit 1
fi

# Check if we're already in a git repo
if [ -d ".git" ]; then
    echo "⚠️  Git repository already exists."
    read -p "Do you want to reinitialize? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 0
    fi
    rm -rf .git
fi

# Initialize repository
echo "📦 Initializing git repository..."
git init

# Create initial commit on main
echo "📝 Creating initial commit..."
git add .
git commit -m "feat: initial project setup"

# Rename default branch to main (if needed)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "🔄 Renaming branch to main..."
    git branch -M main
fi

# Create development branch
echo "🌿 Creating development branch..."
git checkout -b development

echo ""
echo "✅ Git repository setup complete!"
echo ""
echo "📋 Branch Structure:"
echo "   • main        - Production-ready releases"
echo "   • development - Active development (current)"
echo ""
echo "📌 Next Steps:"
echo ""
echo "1. Create a GitHub repository:"
echo "   gh repo create FAX-BANK --public"
echo ""
echo "2. Add remote and push:"
echo "   git remote add origin https://github.com/yourusername/FAX-BANK.git"
echo "   git push -u origin main"
echo "   git push -u origin development"
echo ""
echo "🎉 Happy coding!"
