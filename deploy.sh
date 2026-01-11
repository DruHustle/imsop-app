#!/bin/bash
# IMSOP - Intelligent Multi-Cloud Supply Chain & Operations Platform
# Deployment Script with Database Setup and Rollback Mechanism
# Features: REST API authentication, Mock auth for GitHub Pages, Favicon support
# This script automates deployment with automatic database setup and rollback on failure

set -e  # Exit on any error

echo "🚀 Starting deployment for IMSOP..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Setup database function
setup_database() {
    echo ""
    echo "📦 Setting Up Database..."
    
    if [ -f "./setup-dev-db.sh" ]; then
        print_info "Running database setup script..."
        chmod +x ./setup-dev-db.sh
        ./setup-dev-db.sh
        print_success "Database setup completed"
    else
        print_warning "setup-dev-db.sh not found, skipping database setup"
    fi
}

# Seed demo accounts function
seed_demo_accounts() {
    echo ""
    echo "👥 Seeding Demo Accounts..."
    
    if [ -f "./seed-demo-accounts.mjs" ]; then
        print_info "Seeding demo accounts..."
        node ./seed-demo-accounts.mjs
        print_success "Demo accounts seeded"
    else
        print_warning "seed-demo-accounts.mjs not found, skipping demo account seeding"
    fi
}

# Store the current gh-pages commit for potential rollback
PREVIOUS_COMMIT=$(git rev-parse origin/gh-pages 2>/dev/null || echo "")

# Rollback function
rollback() {
    echo ""
    echo "⚠️  Deployment failed. Initiating rollback..."
    
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

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Error: git is not installed."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed. Please install Node.js and pnpm."
    exit 1
fi

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit: IMSOP Platform"
fi

# Ask for GitHub username if not already configured in remote
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
if [ -z "$REMOTE_URL" ]; then
    echo "🔗 Configuring GitHub repository..."
    read -p "Enter your GitHub username: " USERNAME
    read -p "Enter your repository name (default: imsop-app): " REPO_NAME
    REPO_NAME=${REPO_NAME:-imsop-app}
    git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"
    echo "✅ Remote origin added: https://github.com/$USERNAME/$REPO_NAME.git"
else
    echo "✅ Remote origin already configured: $REMOTE_URL"
fi

# Fetch latest changes
echo "📡 Fetching latest changes..."
git fetch origin

# Store the current gh-pages commit for potential rollback
PREVIOUS_COMMIT=$(git rev-parse origin/gh-pages 2>/dev/null || echo "")

# Setup database and demo accounts
setup_database
seed_demo_accounts

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Run tests
echo "🧪 Running tests..."
if pnpm test 2>/dev/null; then
    echo "✅ All tests passed!"
else
    echo "❌ Tests failed. Aborting deployment."
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

# Check if gh-pages branch exists, if not create it
if ! git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "📝 Creating gh-pages branch..."
    git checkout --orphan gh-pages
    git reset --hard
    git commit --allow-empty -m "Initial gh-pages commit"
    git checkout main 2>/dev/null || git checkout master
fi

# Deploy to GitHub Pages
echo "🚀 Deploying to GitHub Pages..."
echo "NOTE: You may be asked for your GitHub credentials."

# Create a temporary directory for the deployment
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy dist contents to temporary directory
cp -r dist/* "$TEMP_DIR/"

# Switch to gh-pages branch
git checkout gh-pages

# Backup current gh-pages state
BACKUP_COMMIT=$(git rev-parse HEAD)

# Clear old content and copy new content
find . -maxdepth 1 -not -name '.git' -not -name '.gitignore' -exec rm -rf {} +
cp -r "$TEMP_DIR"/* .

# Verify new content was copied
if [ ! -f "index.html" ]; then
    echo "❌ Deployment failed: index.html not found in build output."
    exit 1
fi

# Create .gitignore for gh-pages
cat > .gitignore << 'GITIGNORE'
node_modules/
.DS_Store
Thumbs.db
*.env
GITIGNORE

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

echo ""
echo "✨ Deployment complete!"
REPO_URL=$(git remote get-url origin | sed -E 's/.*github.com[:\/]([^\/]+)\/([^\.]+).*/\1\/\2/')
echo "🌐 Your website should be live at: https://$(echo $REPO_URL | cut -d'/' -f1).github.io/$(echo $REPO_URL | cut -d'/' -f2)"
echo ""
echo "📝 Features:"
echo "   - REST API authentication (/api/auth/login)"
echo "   - Mock authentication for GitHub Pages"
echo "   - Favicon: /favicon.ico (brain icon)"
echo "   - Responsive design with Tailwind CSS"
echo ""
echo "📝 Note: Make sure GitHub Pages is enabled in your repository settings:"
echo "   Settings > Pages > Source: Deploy from a branch > Branch: gh-pages"
echo ""
echo "🔄 Rollback Information:"
echo "   Previous version: $PREVIOUS_COMMIT"
echo "   Current version: $(git rev-parse origin/gh-pages)"
