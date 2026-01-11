#!/bin/bash

# IMSOP - Development Setup Script
# This script sets up the development environment, starts the database, and runs the dev server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

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

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js $(node --version)"
    
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed"
        exit 1
    fi
    print_success "pnpm $(pnpm --version)"
}

# Setup environment
setup_environment() {
    print_header "Setting Up Environment"
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            print_info "Creating .env from .env.example..."
            cp .env.example .env
            # Set local defaults for development
            sed -i 's|DATABASE_URL=.*|DATABASE_URL="mysql://root@localhost:3306/imsop"|' .env
            sed -i 's|VITE_API_URL=.*|VITE_API_URL="http://localhost:3000/api"|' .env
            sed -i 's|BACKEND_URL=.*|BACKEND_URL="http://localhost:3000"|' .env
            sed -i 's|NODE_ENV=.*|NODE_ENV=development|' .env
            print_success ".env created with local development defaults"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_info ".env already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing npm packages..."
        pnpm install
        print_success "Dependencies installed"
    else
        print_info "Dependencies already installed"
    fi
}

# Setup database
setup_database() {
    print_header "Setting Up Database"
    
    if [ -f "./setup-dev-db.sh" ]; then
        print_info "Running database setup script..."
        chmod +x ./setup-dev-db.sh
        ./setup-dev-db.sh || print_warning "Database setup failed. Make sure MySQL is running."
    else
        print_warning "setup-dev-db.sh not found, skipping database setup"
    fi
}

# Start development server
start_dev_server() {
    print_header "Starting Development Server"
    
    echo ""
    echo -e "${GREEN}Development environment is ready!${NC}"
    echo ""
    echo "Access the application at: http://localhost:3000"
    echo ""
    
    pnpm dev
}

# Main function
main() {
    print_header "IMSOP - Development Setup"
    
    check_prerequisites
    setup_environment
    install_dependencies
    setup_database
    start_dev_server
}

# Run main function
main "$@"
