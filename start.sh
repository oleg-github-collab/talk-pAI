#!/bin/bash

# Kaminskyi CryptoTalk Startup Script
# This script handles the complete startup process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="CryptoTalk"
NODE_MIN_VERSION="18"
LOG_DIR="./logs"
BACKUP_DIR="./backups"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_node_version() {
    log_info "Checking Node.js version..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed!"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]; then
        log_error "Node.js version $NODE_MIN_VERSION or higher is required (found: v$NODE_VERSION)"
        exit 1
    fi
    
    log_info "Node.js version check passed ✓"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if [ ! -d "node_modules" ]; then
        log_warn "Dependencies not installed. Installing..."
        npm install
    else
        log_info "Dependencies already installed ✓"
    fi
}

check_env_file() {
    log_info "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        log_warn ".env file not found. Running setup..."
        npm run setup
    else
        log_info "Environment configured ✓"
    fi
}

check_google_drive() {
    log_info "Checking Google Drive configuration..."
    
    if [ -f "service-account.json" ]; then
        log_info "Google Drive service account found ✓"
    else
        log_warn "Google Drive not configured. Using local storage."
    fi
}

create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p uploads/images
    mkdir -p uploads/audio
    mkdir -p data
    
    log_info "Directories created ✓"
}

backup_database() {
    if [ -f "cryptotalk.db" ]; then
        log_info "Backing up database..."
        
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="$BACKUP_DIR/cryptotalk_$TIMESTAMP.db"
        
        cp cryptotalk.db "$BACKUP_FILE"
        
        # Keep only last 10 backups
        ls -t "$BACKUP_DIR"/*.db 2>/dev/null | tail -n +11 | xargs -r rm
        
        log_info "Database backed up to $BACKUP_FILE ✓"
    fi
}

cleanup_old_files() {
    log_info "Cleaning up old files..."
    
    # Clean logs older than 30 days
    find "$LOG_DIR" -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Clean old audio files (older than 3 hours)
    find uploads/audio -name "*" -mmin +180 -delete 2>/dev/null || true
    
    log_info "Cleanup completed ✓"
}

start_app() {
    log_info "Starting $APP_NAME..."
    
    # Check if PM2 is available
    if command -v pm2 &> /dev/null; then
        log_info "Starting with PM2..."
        
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js --env production
            pm2 save
            log_info "$APP_NAME started with PM2 ✓"
            log_info "View logs with: pm2 logs cryptotalk"
            log_info "Monitor with: pm2 monit"
        else
            pm2 start server.js --name cryptotalk
            pm2 save
            log_info "$APP_NAME started with PM2 ✓"
        fi
    else
        log_info "Starting with Node.js..."
        
        # Start in background with output redirection
        nohup node server.js > "$LOG_DIR/cryptotalk.log" 2>&1 &
        
        # Save PID
        echo $! > cryptotalk.pid
        
        log_info "$APP_NAME started (PID: $(cat cryptotalk.pid)) ✓"
        log_info "View logs with: tail -f $LOG_DIR/cryptotalk.log"
    fi
}

health_check() {
    log_info "Performing health check..."
    
    sleep 3  # Wait for server to start
    
    if curl -f http://localhost:3000/health &> /dev/null; then
        log_info "Health check passed ✓"
        log_info ""
        log_info "========================================="
        log_info "$APP_NAME is running!"
        log_info "Access at: http://localhost:3000"
        log_info "========================================="
    else
        log_error "Health check failed!"
        log_error "Check logs for errors"
        exit 1
    fi
}

stop_app() {
    log_info "Stopping $APP_NAME..."
    
    if command -v pm2 &> /dev/null; then
        pm2 stop cryptotalk 2>/dev/null || true
        pm2 delete cryptotalk 2>/dev/null || true
    fi
    
    if [ -f "cryptotalk.pid" ]; then
        PID=$(cat cryptotalk.pid)
        kill $PID 2>/dev/null || true
        rm cryptotalk.pid
    fi
    
    log_info "$APP_NAME stopped ✓"
}

# Main execution
main() {
    echo ""
    echo "========================================="
    echo "   Kaminskyi CryptoTalk Startup Script"
    echo "========================================="
    echo ""
    
    case "${1:-start}" in
        start)
            check_node_version
            check_dependencies
            check_env_file
            check_google_drive
            create_directories
            backup_database
            cleanup_old_files
            start_app
            health_check
            ;;
        stop)
            stop_app
            ;;
        restart)
            stop_app
            sleep 2
            main start
            ;;
        status)
            if command -v pm2 &> /dev/null; then
                pm2 status cryptotalk
            elif [ -f "cryptotalk.pid" ]; then
                PID=$(cat cryptotalk.pid)
                if ps -p $PID > /dev/null; then
                    log_info "$APP_NAME is running (PID: $PID)"
                else
                    log_warn "$APP_NAME is not running"
                fi
            else
                log_warn "$APP_NAME status unknown"
            fi
            ;;
        logs)
            if command -v pm2 &> /dev/null; then
                pm2 logs cryptotalk
            else
                tail -f "$LOG_DIR/cryptotalk.log"
            fi
            ;;
        backup)
            backup_database
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|logs|backup}"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"