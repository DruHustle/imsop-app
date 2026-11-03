#!/bin/bash

# IMSOP - Development Setup Script
# This script sets up and runs the frontend development server.

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

# Start development server
start_dev_server() {
    print_header "Starting Development Server"
    
    echo ""
    echo -e "${GREEN}Development environment is ready!${NC}"
    echo ""
    echo "Access the application at: http://localhost:5173"
    echo ""
    
    pnpm dev
}

# Main function
main() {
    print_header "IMSOP - Development Setup"
    
    check_prerequisites
    setup_environment
    install_dependencies
    start_dev_server
}

# Run main function
main "$@"
