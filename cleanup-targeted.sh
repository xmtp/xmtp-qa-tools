#!/bin/bash

# Targeted cleanup of specific large files from git history
# This is a safer, more focused approach

set -e

echo "🎯 Starting targeted repository cleanup..."

# Add git-filter-repo to PATH
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Create a backup branch
echo "📦 Creating backup branch..."
git branch backup-targeted-cleanup-$(date +%Y%m%d-%H%M%S)

# Show current repository size
echo "📊 Current repository size:"
du -sh .git

echo "🧹 Removing specific large files from git history..."

# Remove the largest files we identified
git filter-repo \
    --path .data/ \
    --path-glob '*.log' \
    --path-glob '*.gif' \
    --path-glob '*.data*' \
    --path logs/ \
    --path-glob 'logs/**' \
    --path-glob 'bugs/**/.data/' \
    --path-glob 'bugs/**/.data/**' \
    --invert-paths \
    --force

# Clean up and optimize
echo "🔧 Optimizing repository..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Show final repository size
echo "📊 Final repository size:"
du -sh .git

echo "✅ Targeted cleanup completed!"
echo "💡 Next steps:"
echo "   1. Test the repository: git log --oneline | head -10"
echo "   2. Force push: git push --force-with-lease origin main"
echo "   3. Team members should re-clone the repository" 