#!/usr/bin/env node

/**
 * Talk pAI Deployment Validator
 * Comprehensive pre-deployment and runtime validation script
 * Ensures zero-error deployment on Railway
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

class DeploymentValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.checks = [];
        this.startTime = Date.now();
    }

    log(level, message, details = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, level, message, details };

        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
        if (details) {
            console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
        }

        this.checks.push(logEntry);
    }

    error(message, details = null) {
        this.errors.push({ message, details });
        this.log('error', message, details);
    }

    warn(message, details = null) {
        this.warnings.push({ message, details });
        this.log('warn', message, details);
    }

    info(message, details = null) {
        this.log('info', message, details);
    }

    success(message, details = null) {
        this.log('success', message, details);
    }

    // Pre-deployment validation
    async validatePreDeployment() {
        this.info('🔍 Starting pre-deployment validation...');

        await this.validateFileStructure();
        await this.validatePackageJson();
        await this.validateEnvironmentSetup();
        await this.validateDatabaseSchema();
        await this.validateAssets();
        await this.validateSecurity();
        await this.validateDockerfile();
        await this.validateRailwayConfig();

        return this.getValidationSummary();
    }

    // Runtime validation
    async validateRuntime(port = 3000) {
        this.info('🚀 Starting runtime validation...');

        await this.validateServerStartup(port);
        await this.validateHealthEndpoints(port);
        await this.validateAPIEndpoints(port);
        await this.validateWebSocketConnection(port);
        await this.validateDatabaseConnection();
        await this.validateFilePermissions();

        return this.getValidationSummary();
    }

    async validateFileStructure() {
        this.info('📁 Validating file structure...');

        const requiredFiles = [
            'package.json',
            'server.js',
            'database/init-database.js',
            'database/production-schema.sql',
            'public/index.html',
            'public/js/auth.js',
            'public/js/core/messenger-core.js',
            'Dockerfile',
            'railway.json'
        ];

        for (const file of requiredFiles) {
            try {
                await fs.access(file);
                this.success(`✅ Found required file: ${file}`);
            } catch (error) {
                this.error(`❌ Missing required file: ${file}`, { error: error.message });
            }
        }

        const optionalDirectories = ['uploads', 'logs', 'webrtc-server'];
        for (const dir of optionalDirectories) {
            try {
                await fs.access(dir);
                this.success(`✅ Found directory: ${dir}`);
            } catch (error) {
                this.warn(`⚠️ Optional directory not found: ${dir}`);
            }
        }
    }

    async validatePackageJson() {
        this.info('📦 Validating package.json...');

        try {
            const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));

            // Check required scripts
            const requiredScripts = ['start'];
            for (const script of requiredScripts) {
                if (!packageJson.scripts || !packageJson.scripts[script]) {
                    this.error(`❌ Missing required script: ${script}`);
                } else {
                    this.success(`✅ Found script: ${script}`);
                }
            }

            // Check required dependencies
            const requiredDeps = ['express', 'socket.io', 'pg', 'cors', 'helmet'];
            for (const dep of requiredDeps) {
                if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
                    this.error(`❌ Missing required dependency: ${dep}`);
                } else {
                    this.success(`✅ Found dependency: ${dep}`);
                }
            }

            // Check Node.js version
            if (packageJson.engines && packageJson.engines.node) {
                this.success(`✅ Node.js version specified: ${packageJson.engines.node}`);
            } else {
                this.warn('⚠️ No Node.js version specified in engines');
            }

        } catch (error) {
            this.error('❌ Failed to read or parse package.json', { error: error.message });
        }
    }

    async validateEnvironmentSetup() {
        this.info('🔧 Validating environment setup...');

        const requiredEnvVars = ['NODE_ENV'];
        const optionalEnvVars = ['DATABASE_URL', 'PORT', 'OPENAI_API_KEY'];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                this.error(`❌ Missing required environment variable: ${envVar}`);
            } else {
                this.success(`✅ Found environment variable: ${envVar}`);
            }
        }

        for (const envVar of optionalEnvVars) {
            if (process.env[envVar]) {
                this.success(`✅ Found optional environment variable: ${envVar}`);
            } else {
                this.info(`ℹ️ Optional environment variable not set: ${envVar}`);
            }
        }

        // Check for .env.example
        try {
            await fs.access('.env.example');
            this.success('✅ Found .env.example file');
        } catch (error) {
            this.warn('⚠️ No .env.example file found');
        }
    }

    async validateDatabaseSchema() {
        this.info('🗄️ Validating database schema...');

        try {
            const schemaContent = await fs.readFile('database/production-schema.sql', 'utf8');

            // Check for essential tables
            const requiredTables = ['users', 'chats', 'messages', 'chat_participants'];
            for (const table of requiredTables) {
                if (schemaContent.includes(`CREATE TABLE ${table}`) || schemaContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
                    this.success(`✅ Found table definition: ${table}`);
                } else {
                    this.error(`❌ Missing table definition: ${table}`);
                }
            }

            // Check for UUID extension
            if (schemaContent.includes('uuid-ossp') || schemaContent.includes('gen_random_uuid()')) {
                this.success('✅ UUID support configured');
            } else {
                this.warn('⚠️ No UUID extension found');
            }

            // Check for indexes
            if (schemaContent.includes('CREATE INDEX') || schemaContent.includes('CREATE UNIQUE INDEX')) {
                this.success('✅ Database indexes defined');
            } else {
                this.warn('⚠️ No database indexes found');
            }

        } catch (error) {
            this.error('❌ Failed to read database schema', { error: error.message });
        }
    }

    async validateAssets() {
        this.info('🎨 Validating static assets...');

        const assetPaths = [
            'public/css/mobile-responsive.css',
            'public/js/core/messenger-core.js',
            'public/js/auth.js'
        ];

        for (const assetPath of assetPaths) {
            try {
                const stats = await fs.stat(assetPath);
                if (stats.size > 0) {
                    this.success(`✅ Asset valid: ${assetPath} (${stats.size} bytes)`);
                } else {
                    this.warn(`⚠️ Asset is empty: ${assetPath}`);
                }
            } catch (error) {
                this.error(`❌ Asset missing or invalid: ${assetPath}`, { error: error.message });
            }
        }
    }

    async validateSecurity() {
        this.info('🔒 Validating security configuration...');

        try {
            const serverContent = await fs.readFile('server.js', 'utf8');

            // Check for security middleware
            const securityChecks = [
                { name: 'helmet', pattern: /helmet\(/ },
                { name: 'cors', pattern: /cors\(/ },
                { name: 'rate limiting', pattern: /rateLimit\(/ },
                { name: 'trust proxy', pattern: /trust proxy/ }
            ];

            for (const check of securityChecks) {
                if (check.pattern.test(serverContent)) {
                    this.success(`✅ Security feature enabled: ${check.name}`);
                } else {
                    this.error(`❌ Security feature missing: ${check.name}`);
                }
            }

            // Check for environment-based configuration
            if (serverContent.includes('process.env.NODE_ENV')) {
                this.success('✅ Environment-based configuration detected');
            } else {
                this.warn('⚠️ No environment-based configuration found');
            }

        } catch (error) {
            this.error('❌ Failed to validate security configuration', { error: error.message });
        }
    }

    async validateDockerfile() {
        this.info('🐳 Validating Dockerfile...');

        try {
            const dockerContent = await fs.readFile('Dockerfile', 'utf8');

            const dockerChecks = [
                { name: 'Base image', pattern: /FROM node:/ },
                { name: 'Working directory', pattern: /WORKDIR/ },
                { name: 'Dependencies copy', pattern: /COPY package.*\.json/ },
                { name: 'NPM install', pattern: /npm ci|npm install/ },
                { name: 'Port exposure', pattern: /EXPOSE/ },
                { name: 'Health check', pattern: /HEALTHCHECK/ },
                { name: 'Non-root user', pattern: /USER/ }
            ];

            for (const check of dockerChecks) {
                if (check.pattern.test(dockerContent)) {
                    this.success(`✅ Dockerfile feature: ${check.name}`);
                } else {
                    this.warn(`⚠️ Dockerfile missing: ${check.name}`);
                }
            }

        } catch (error) {
            this.error('❌ Failed to validate Dockerfile', { error: error.message });
        }
    }

    async validateRailwayConfig() {
        this.info('🚂 Validating Railway configuration...');

        try {
            const railwayContent = await fs.readFile('railway.json', 'utf8');
            const config = JSON.parse(railwayContent);

            if (config.build) {
                this.success('✅ Railway build configuration found');
            }

            if (config.deploy) {
                this.success('✅ Railway deploy configuration found');

                if (config.deploy.restartPolicyType) {
                    this.success(`✅ Restart policy: ${config.deploy.restartPolicyType}`);
                }
            }

        } catch (error) {
            this.error('❌ Failed to validate Railway configuration', { error: error.message });
        }
    }

    async validateServerStartup(port) {
        this.info(`🚀 Validating server startup on port ${port}...`);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.error(`❌ Server startup timeout (30s) on port ${port}`);
                resolve();
            }, 30000);

            const checkServer = () => {
                const req = http.request({
                    hostname: 'localhost',
                    port: port,
                    path: '/health',
                    timeout: 5000
                }, (res) => {
                    clearTimeout(timeout);
                    if (res.statusCode === 200) {
                        this.success(`✅ Server responding on port ${port}`);
                    } else {
                        this.error(`❌ Server responded with status ${res.statusCode}`);
                    }
                    resolve();
                });

                req.on('error', (err) => {
                    if (err.code === 'ECONNREFUSED') {
                        // Server not ready yet, retry
                        setTimeout(checkServer, 1000);
                    } else {
                        clearTimeout(timeout);
                        this.error(`❌ Server connection error: ${err.message}`);
                        resolve();
                    }
                });

                req.end();
            };

            // Start checking after a brief delay
            setTimeout(checkServer, 2000);
        });
    }

    async validateHealthEndpoints(port) {
        this.info('🩺 Validating health endpoints...');

        const endpoints = ['/health', '/healthz', '/ping'];

        for (const endpoint of endpoints) {
            try {
                const result = await this.makeHttpRequest('localhost', port, endpoint);
                if (result.statusCode === 200) {
                    this.success(`✅ Health endpoint working: ${endpoint}`);
                } else {
                    this.warn(`⚠️ Health endpoint returned ${result.statusCode}: ${endpoint}`);
                }
            } catch (error) {
                this.error(`❌ Health endpoint failed: ${endpoint}`, { error: error.message });
            }
        }
    }

    async validateAPIEndpoints(port) {
        this.info('🔌 Validating API endpoints...');

        const apiEndpoints = [
            '/api/v2/demo/chats',
            '/api/auth/health',
            '/api/chat/health'
        ];

        for (const endpoint of apiEndpoints) {
            try {
                const result = await this.makeHttpRequest('localhost', port, endpoint);
                if (result.statusCode < 500) {
                    this.success(`✅ API endpoint accessible: ${endpoint}`);
                } else {
                    this.error(`❌ API endpoint server error: ${endpoint} (${result.statusCode})`);
                }
            } catch (error) {
                this.warn(`⚠️ API endpoint unreachable: ${endpoint}`, { error: error.message });
            }
        }
    }

    async validateWebSocketConnection(port) {
        this.info('🔌 Validating WebSocket connection...');

        // This is a basic check - in production, you'd want more comprehensive WebSocket testing
        try {
            const result = await this.makeHttpRequest('localhost', port, '/socket.io/', { timeout: 5000 });
            if (result.statusCode === 200 || result.statusCode === 400) {
                this.success('✅ Socket.IO endpoint responsive');
            } else {
                this.warn(`⚠️ Socket.IO endpoint returned ${result.statusCode}`);
            }
        } catch (error) {
            this.error('❌ Socket.IO endpoint failed', { error: error.message });
        }
    }

    async validateDatabaseConnection() {
        this.info('🗄️ Validating database connection...');

        try {
            const DatabaseInitializer = require('./database/init-database');
            const db = new DatabaseInitializer();

            const connected = await db.connect();
            if (connected) {
                this.success('✅ Database connection successful');

                const healthCheck = await db.healthCheck();
                if (healthCheck.connected) {
                    this.success(`✅ Database health check passed (${healthCheck.type})`);
                } else {
                    this.error('❌ Database health check failed', healthCheck);
                }

                await db.close();
            } else {
                this.error('❌ Database connection failed');
            }
        } catch (error) {
            this.error('❌ Database validation failed', { error: error.message });
        }
    }

    async validateFilePermissions() {
        this.info('📝 Validating file permissions...');

        const checkPaths = ['uploads', 'logs', 'public'];

        for (const checkPath of checkPaths) {
            try {
                await fs.access(checkPath, fs.constants.R_OK | fs.constants.W_OK);
                this.success(`✅ Directory permissions OK: ${checkPath}`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.info(`ℹ️ Directory doesn't exist: ${checkPath}`);
                } else {
                    this.warn(`⚠️ Permission issue: ${checkPath}`, { error: error.message });
                }
            }
        }
    }

    makeHttpRequest(hostname, port, path, options = {}) {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname,
                port,
                path,
                timeout: options.timeout || 10000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    getValidationSummary() {
        const duration = Date.now() - this.startTime;
        const summary = {
            duration: `${duration}ms`,
            errors: this.errors.length,
            warnings: this.warnings.length,
            totalChecks: this.checks.length,
            success: this.errors.length === 0,
            details: {
                errors: this.errors,
                warnings: this.warnings
            }
        };

        this.info('📊 Validation Summary', summary);

        if (summary.success) {
            this.success('🎉 All validations passed! Deployment ready.');
        } else {
            this.error(`❌ ${summary.errors} errors found. Fix before deployment.`);
        }

        return summary;
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: this.getValidationSummary(),
            checks: this.checks
        };

        try {
            await fs.mkdir('logs', { recursive: true });
            const reportPath = `logs/deployment-validation-${Date.now()}.json`;
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            this.info(`📄 Validation report saved: ${reportPath}`);
        } catch (error) {
            this.warn('⚠️ Could not save validation report', { error: error.message });
        }

        return report;
    }
}

// CLI Interface
if (require.main === module) {
    const validator = new DeploymentValidator();
    const command = process.argv[2] || 'pre-deployment';
    const port = parseInt(process.argv[3]) || process.env.PORT || 3000;

    (async () => {
        try {
            let result;

            switch (command) {
                case 'pre-deployment':
                    result = await validator.validatePreDeployment();
                    break;
                case 'runtime':
                    result = await validator.validateRuntime(port);
                    break;
                case 'full':
                    await validator.validatePreDeployment();
                    result = await validator.validateRuntime(port);
                    break;
                default:
                    console.error('Usage: node deployment-validator.js [pre-deployment|runtime|full] [port]');
                    process.exit(1);
            }

            await validator.generateReport();
            process.exit(result.success ? 0 : 1);

        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = DeploymentValidator;