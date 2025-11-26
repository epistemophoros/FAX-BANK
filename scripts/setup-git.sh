#!/bin/bash

# Foundry VTT Module - Git Setup Script
# This script initializes the git repository with main and development branches

set -e

echo "🎮 Setting up Foundry VTT Module Repository..."
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
git commit -m "feat: initial project setup

- TypeScript-based Foundry VTT module structure
- Vite build system with hot reload
- ESLint and Prettier configuration
- Vitest for unit testing
- GitHub Actions CI/CD workflows
- Example Application with styled UI
- Module settings and i18n support"

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
echo "   gh repo create foundry-example-module --public"
echo ""
echo "2. Add remote and push:"
echo "   git remote add origin https://github.com/yourusername/foundry-example-module.git"
echo "   git push -u origin main"
echo "   git push -u origin development"
echo ""
echo "3. Set default branch to 'development' on GitHub:"
echo "   Settings → Branches → Default branch → development"
echo ""
echo "4. Set up branch protection for 'main':"
echo "   Settings → Branches → Add rule → 'main'"
echo "   - Require pull request reviews"
echo "   - Require status checks (CI)"
echo ""
echo "🎉 Happy coding!"

