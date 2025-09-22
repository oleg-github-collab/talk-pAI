const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class EnhancedAuthRoutes {
    constructor(database, logger) {
        this.db = database;
        this.logger = logger;
        this.router = express.Router();
        this.setupRoutes();
    }

    getRouter() {
        return this.router;
    }

    setupRoutes() {
        // Create rate limiters
        const loginLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per IP
            message: { success: false, message: 'Too many login attempts, please try again later' },
            standardHeaders: true,
            legacyHeaders: false,
        });

        const registrationLimiter = rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3, // 3 registrations per IP per hour
            message: { success: false, message: 'Too many registration attempts, please try again later' },
            standardHeaders: true,
            legacyHeaders: false,
        });

        // Registration endpoint
        this.router.post('/register', registrationLimiter, this.register.bind(this));

        // Login endpoint
        this.router.post('/login', loginLimiter, this.login.bind(this));

        // Get current user endpoint
        this.router.get('/me', this.getCurrentUser.bind(this));

        // Logout endpoint
        this.router.post('/logout', this.logout.bind(this));

        // Get users endpoint
        this.router.get('/users', this.getUsers.bind(this));

        // Password reset request
        this.router.post('/forgot-password', this.forgotPassword.bind(this));

        // Reset password with token
        this.router.post('/reset-password', this.resetPassword.bind(this));
    }

    async register(req, res) {
        try {
            const { nickname, email, password, displayName } = req.body;

            // Validation
            if (!nickname || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Nickname and password are required'
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 8 characters long'
                });
            }

            // Check if nickname already exists
            const existingUser = await this.db.query(
                'SELECT id FROM users WHERE nickname = $1',
                [nickname]
            );

            if (existingUser.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Nickname already exists'
                });
            }

            // Check if email already exists (if provided)
            if (email) {
                const existingEmail = await this.db.query(
                    'SELECT id FROM users WHERE email = $1',
                    [email]
                );

                if (existingEmail.rows.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email already exists'
                    });
                }
            }

            // Hash password
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Create user
            const userId = uuidv4();
            const result = await this.db.query(`
                INSERT INTO users (
                    id, nickname, email, password_hash, display_name,
                    created_at, updated_at, last_seen
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id, nickname, email, display_name, avatar, theme, status, created_at
            `, [userId, nickname, email, passwordHash, displayName || nickname]);

            const user = result.rows[0];

            // Create user settings
            await this.db.query(`
                INSERT INTO user_settings (user_id) VALUES ($1)
            `, [userId]);

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, nickname: user.nickname },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            this.logger.info('User registered successfully', { userId: user.id, nickname: user.nickname });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: {
                    id: user.id,
                    nickname: user.nickname,
                    email: user.email,
                    displayName: user.display_name,
                    avatar: user.avatar,
                    theme: user.theme,
                    status: user.status
                },
                token
            });

        } catch (error) {
            this.logger.error('Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Registration failed. Please try again.'
            });
        }
    }

    async login(req, res) {
        try {
            const { nickname, password } = req.body;

            if (!nickname || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Nickname and password are required'
                });
            }

            // Find user
            const result = await this.db.query(`
                SELECT id, nickname, email, password_hash, display_name, avatar, theme, status, is_active
                FROM users WHERE nickname = $1
            `, [nickname]);

            if (result.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const user = result.rows[0];

            if (!user.is_active) {
                return res.status(401).json({
                    success: false,
                    message: 'Account is deactivated'
                });
            }

            // Verify password
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Update last login
            await this.db.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, nickname: user.nickname },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            this.logger.info('User logged in successfully', { userId: user.id, nickname: user.nickname });

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: user.id,
                    nickname: user.nickname,
                    email: user.email,
                    displayName: user.display_name,
                    avatar: user.avatar,
                    theme: user.theme,
                    status: user.status
                },
                token
            });

        } catch (error) {
            this.logger.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Login failed. Please try again.'
            });
        }
    }

    async getCurrentUser(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    message: 'No token provided'
                });
            }

            const token = authHeader.substring(7);

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

                const result = await this.db.query(`
                    SELECT id, nickname, email, display_name, avatar, theme, status, last_seen
                    FROM users WHERE id = $1 AND is_active = true
                `, [decoded.userId]);

                if (result.rows.length === 0) {
                    return res.status(401).json({
                        success: false,
                        message: 'User not found'
                    });
                }

                const user = result.rows[0];

                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        nickname: user.nickname,
                        email: user.email,
                        displayName: user.display_name,
                        avatar: user.avatar,
                        theme: user.theme,
                        status: user.status,
                        lastSeen: user.last_seen
                    }
                });

            } catch (jwtError) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token'
                });
            }

        } catch (error) {
            this.logger.error('Get current user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user information'
            });
        }
    }

    async logout(req, res) {
        try {
            // For now, just return success
            // In a more advanced implementation, you would invalidate the token
            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            this.logger.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    }

    async getUsers(req, res) {
        try {
            const result = await this.db.query(`
                SELECT id, nickname, display_name, avatar, status, last_seen
                FROM users
                WHERE is_active = true
                ORDER BY last_seen DESC
                LIMIT 50
            `);

            res.json({
                success: true,
                users: result.rows.map(user => ({
                    id: user.id,
                    nickname: user.nickname,
                    displayName: user.display_name,
                    avatar: user.avatar,
                    status: user.status,
                    lastSeen: user.last_seen
                }))
            });

        } catch (error) {
            this.logger.error('Get users error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get users'
            });
        }
    }

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required'
                });
            }

            // For now, just return success message
            // In production, you would send an actual email
            res.json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent'
            });

        } catch (error) {
            this.logger.error('Forgot password error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to process password reset request'
            });
        }
    }

    async resetPassword(req, res) {
        try {
            const { token, password } = req.body;

            if (!token || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Token and new password are required'
                });
            }

            // For now, just return an error since we don't have a full implementation
            res.status(400).json({
                success: false,
                message: 'Password reset functionality is not yet implemented'
            });

        } catch (error) {
            this.logger.error('Reset password error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reset password'
            });
        }
    }
}

module.exports = EnhancedAuthRoutes;