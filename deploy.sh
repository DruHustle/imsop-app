#!/bin/bash
# IMSOP - Intelligent Multi-Cloud Supply Chain & Operations Platform
# Deployment Script 
# Features: Automated Build, Testing, and Safe Rollback Mechanism

set -e  # Exit on any error

echo "🚀 Starting deployment for IMSOP (Client-Side Storage Version)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Store the current gh-pages commit for potential rollback
PREVIOUS_COMMIT=$(git rev-parse origin/gh-pages 2>/dev/null || echo "")

# Rollback function
rollback() {
    echo ""
    echo -e "${RED}⚠️  Deployment failed. Initiating rollback...${NC}"
    
    if [ -z "$PREVIOUS_COMMIT" ]; then
        echo "❌ No previous version available for rollback."
        exit 1
    fi
    
    echo "📦 Rolling back to previous version: $PREVIOUS_COMMIT"
    git checkout gh-pages
    git reset --hard "$PREVIOUS_COMMIT"
    git push origin gh-pages --force
    
    git checkout main 2>/dev/null || git checkout master
    
    echo "✅ Rollback complete! Website reverted to previous working version."
    exit 1
}

# Set trap to call rollback on error
trap rollback ERR

# Check prerequisites
if ! command -v git &> /dev/null; then
    echo "❌ Error: git is not installed."
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed."
    exit 1
fi

# Initialize git if needed
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit: IMSOP Platform"
fi

# Check Remote Configuration
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
if [ -z "$REMOTE_URL" ]; then
    echo "🔗 Configuring GitHub repository..."
    read -p "Enter your GitHub username: " USERNAME
    read -p "Enter your repository name (default: imsop-app): " REPO_NAME
    REPO_NAME=${REPO_NAME:-imsop-app}
    git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"
    print_success "Remote origin added"
else
    print_success "Remote origin configured: $REMOTE_URL"
fi

# Fetch latest changes
echo "📡 Fetching latest changes..."
git fetch origin

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile || pnpm install

# Run tests (Fixed to show errors)
echo "🧪 Running tests..."
if pnpm test --reporter=default; then
    print_success "All tests passed!"
else
    echo "❌ Tests failed. See report above. Aborting deployment."
    exit 1
fi

# Build the project
echo "🏗️ Building project..."
pnpm build

# Verify build output exists
if [ ! -d "dist" ]; then
    echo "❌ Build failed: dist directory not found."
    exit 1
fi

# Ensure gh-pages branch exists
if ! git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "📝 Creating gh-pages branch..."
    git checkout --orphan gh-pages
    git reset --hard
    git commit --allow-empty -m "Initial gh-pages commit"
    git checkout main 2>/dev/null || git checkout master
fi

# Deploy to GitHub Pages
echo "🚀 Deploying to GitHub Pages..."

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy dist contents to temporary directory
cp -r dist/* "$TEMP_DIR/"

# Switch to gh-pages branch
git checkout gh-pages

# Clear old content but PRESERVE the .git folder
echo "🧹 Cleaning old files..."
find . -maxdepth 1 -not -name '.git' -not -name '.' -exec rm -rf {} +

# Copy new content
cp -r "$TEMP_DIR"/* .

# Verify new content was copied
if [ ! -f "index.html" ]; then
    echo "❌ Deployment failed: index.html not found in build output."
    exit 1
fi

# Create .gitignore using printf (Fixed: More robust than heredoc)
printf "node_modules/\n.DS_Store\nThumbs.db\n*.env\n" > .gitignore
print_success ".gitignore created"

# Commit and push
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || echo "ℹ️  No changes to commit"

# Push with error handling
if ! git push origin gh-pages --force; then
    echo "❌ Failed to push to gh-pages branch."
    exit 1
fi

# Switch back to main branch
git checkout main 2>/dev/null || git checkout master

echo -e "\n${GREEN}✨ Deployment complete!${NC}"
REPO_URL=$(git remote get-url origin | sed -E 's/.*github.com[:\/]([^\/]+)\/([^\.]+).*/\1\/\2/')
echo "🌐 Your website is live at: https://$(echo $REPO_URL | cut -d'/' -f1).github.io/$(echo $REPO_URL | cut -d'/' -f2)"
echo -e "\n📝 Data Note: Using localStorage for demo persistency."