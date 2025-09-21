# Talk pAI Enhanced Messenger - Deployment Guide

## 🚀 Complete Production Deployment Guide

This guide covers deploying the Talk pAI Enhanced Messenger with all advanced features including 2FA, WebRTC calls, AI assistance, and enterprise functionality.

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-deployment Setup](#pre-deployment-setup)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Local Development](#local-development)
6. [Production Deployment](#production-deployment)
7. [Docker Deployment](#docker-deployment)
8. [Cloud Deployment](#cloud-deployment)
9. [SSL/HTTPS Setup](#ssl-https-setup)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

## 🖥️ System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04+, CentOS 8+, or Docker-compatible

### Recommended Production Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **OS**: Ubuntu 22.04 LTS
- **Load Balancer**: Nginx or similar

### Software Dependencies
- **Node.js**: 18.0.0+
- **PostgreSQL**: 13+
- **Redis**: 6.0+ (optional, for scaling)
- **Nginx**: 1.18+ (for reverse proxy)

## 🔧 Pre-deployment Setup

### 1. Install Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database user
sudo -u postgres createuser --interactive
sudo -u postgres createdb talkpai
```

### 3. Install Nginx (for production)

```bash
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 🗄️ Database Setup

### 1. Create Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE talkpai;
CREATE USER talkpai_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE talkpai TO talkpai_user;

# Enable required extensions
\c talkpai
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\q
```

### 2. Run Database Schema

```bash
# Navigate to project directory
cd /path/to/talk-pAI

# Run the database schema
psql -U talkpai_user -d talkpai -f database/production-schema.sql
```

## ⚙️ Environment Configuration

### 1. Copy Environment File

```bash
cp .env.enhanced.example .env
```

### 2. Configure Required Variables

Edit `.env` file with your specific values:

```bash
# Database
DATABASE_URL=postgresql://talkpai_user:your_secure_password@localhost:5432/talkpai

# Security
JWT_SECRET=your-super-secret-jwt-key-min-64-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-64-chars
SESSION_SECRET=your-session-secret-min-32-chars

# OpenAI (for AI features)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Production settings
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

### 3. Generate Secure Secrets

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🛠️ Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Development Database

```bash
# Create development database
createdb talkpai_dev

# Run schema
psql -d talkpai_dev -f database/production-schema.sql
```

### 3. Start Development Server

```bash
# Start with nodemon for auto-reload
npm run dev

# Or start with the enhanced server
node enhanced-server.js
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **API Status**: http://localhost:3000/api/status
- **Health Check**: http://localhost:3000/health

## 🌐 Production Deployment

### 1. Prepare Production Server

```bash
# Create application user
sudo adduser talkpai
sudo usermod -aG sudo talkpai

# Switch to application user
sudo su - talkpai

# Clone repository
git clone https://github.com/your-repo/talk-pAI.git
cd talk-pAI
```

### 2. Install and Build

```bash
# Install dependencies
npm install --production

# Create uploads directory
mkdir -p uploads/chat uploads/speech uploads/images

# Set proper permissions
chmod 755 uploads
chmod 755 uploads/*
```

### 3. Setup Process Manager (PM2)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'talkpai-enhanced',
    script: './enhanced-server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### 4. Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/talkpai << EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Increase timeout for file uploads
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 100M;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/talkpai /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## 🐳 Docker Deployment

### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S talkpai -u 1001

# Copy application code
COPY --chown=talkpai:nodejs . .

# Create uploads directory
RUN mkdir -p uploads/chat uploads/speech uploads/images
RUN chown -R talkpai:nodejs uploads

USER talkpai

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "enhanced-server.js"]
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  talkpai:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://talkpai:password@postgres:5432/talkpai
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: talkpai
      POSTGRES_USER: talkpai
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/production-schema.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/private
    depends_on:
      - talkpai
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Deploy with Docker

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f talkpai

# Scale the application
docker-compose up -d --scale talkpai=3
```

## ☁️ Cloud Deployment

### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Heroku Deployment

```bash
# Install Heroku CLI
# Create Procfile
echo "web: node enhanced-server.js" > Procfile

# Deploy
heroku create your-app-name
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set NODE_ENV=production
git push heroku main
```

### AWS EC2 Deployment

```bash
# Launch EC2 instance with Ubuntu 22.04
# Configure security groups (ports 22, 80, 443)
# Follow production deployment steps above
```

## 🔒 SSL/HTTPS Setup

### 1. Let's Encrypt (Free SSL)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal setup
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Update Nginx for HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Rest of your configuration...
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## 📊 Monitoring & Maintenance

### 1. Setup Logging

```bash
# Create log rotation
sudo tee /etc/logrotate.d/talkpai << EOF
/home/talkpai/talk-pAI/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 talkpai talkpai
    postrotate
        pm2 reload talkpai-enhanced
    endscript
}
EOF
```

### 2. Database Backup

```bash
# Create backup script
cat > /home/talkpai/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/talkpai/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U talkpai_user -h localhost talkpai > $BACKUP_DIR/talkpai_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/talkpai_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /home/talkpai/backup.sh

# Schedule daily backup
crontab -e
# Add: 0 2 * * * /home/talkpai/backup.sh
```

### 3. Health Monitoring

```bash
# Create health check script
cat > /home/talkpai/healthcheck.js << 'EOF'
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
EOF
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connection
psql -U talkpai_user -d talkpai -c "SELECT version();"

# Check logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 2. Application Won't Start
```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs talkpai-enhanced

# Check environment variables
pm2 env talkpai-enhanced
```

#### 3. WebSocket Connection Issues
```bash
# Check Nginx configuration
sudo nginx -t

# Test WebSocket connectivity
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: SGVsbG8gd29ybGQ=" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:3000/socket.io/
```

#### 4. File Upload Issues
```bash
# Check upload directory permissions
ls -la uploads/

# Fix permissions if needed
chmod -R 755 uploads/
chown -R talkpai:talkpai uploads/
```

### Performance Optimization

#### 1. Enable Gzip Compression in Nginx
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied expired no-cache no-store private must-revalidate auth;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/xml+rss
    application/json;
```

#### 2. Enable Caching
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 🚀 Production Checklist

Before going live, ensure:

- [ ] Database is properly configured and backed up
- [ ] All environment variables are set correctly
- [ ] SSL certificate is installed and working
- [ ] Nginx configuration is optimized
- [ ] PM2 is configured for auto-restart
- [ ] Log rotation is setup
- [ ] Monitoring is in place
- [ ] Database backups are automated
- [ ] Firewall is properly configured
- [ ] Security headers are enabled
- [ ] Rate limiting is configured
- [ ] Health checks are working
- [ ] Email notifications are working
- [ ] OAuth providers are configured
- [ ] AI features are tested
- [ ] WebRTC calls are working

## 📞 Support

For deployment support:
- Email: support@talkpai.com
- Documentation: [docs.talkpai.com](https://docs.talkpai.com)
- GitHub Issues: [github.com/your-repo/talk-pAI/issues](https://github.com/your-repo/talk-pAI/issues)

---

**🎉 Congratulations! Your Talk pAI Enhanced Messenger is now ready for production use!**