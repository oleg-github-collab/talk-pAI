const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

class EnhancedAuthService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
        this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');

        this.initializeMailer();
    }

    initializeMailer() {
        this.mailer = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // Enhanced user registration with email verification
    async registerUser({ nickname, email, password, displayName }) {
        try {
            // Validate input
            if (!this.validateNickname(nickname)) {
                throw new Error('Invalid nickname format');
            }

            if (email && !this.validateEmail(email)) {
                throw new Error('Invalid email format');
            }

            if (!this.validatePassword(password)) {
                throw new Error('Password must be at least 8 characters with uppercase, lowercase, number and special character');
            }

            // Check if user already exists
            const existingUser = await this.pool.query(
                'SELECT id FROM users WHERE nickname = $1 OR email = $2',
                [nickname, email]
            );

            if (existingUser.rows.length > 0) {
                throw new Error('User with this nickname or email already exists');
            }

            // Generate salt and hash password
            const salt = crypto.randomBytes(32).toString('hex');
            const passwordHash = await bcrypt.hash(password + salt, 12);

            // Create user
            const userResult = await this.pool.query(`
                INSERT INTO users (nickname, email, password_hash, salt, display_name, is_verified)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, nickname, email, display_name, created_at
            `, [nickname, email, passwordHash, salt, displayName || nickname, !email]);

            const user = userResult.rows[0];

            // Create user settings
            await this.pool.query(`
                INSERT INTO user_settings (user_id) VALUES ($1)
            `, [user.id]);

            // Send verification email if email provided
            if (email) {
                await this.sendVerificationEmail(user);
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    nickname: user.nickname,
                    email: user.email,
                    displayName: user.display_name,
                    isVerified: !email,
                    createdAt: user.created_at
                }
            };

        } catch (error) {
            throw new Error(`Registration failed: ${error.message}`);
        }
    }

    // Enhanced login with device tracking and rate limiting
    async loginUser({ identifier, password, deviceInfo = {}, rememberMe = false }) {
        try {
            // Find user by nickname or email
            const userResult = await this.pool.query(`
                SELECT u.*, us.* FROM users u
                LEFT JOIN user_settings us ON u.id = us.user_id
                WHERE u.nickname = $1 OR u.email = $1
            `, [identifier]);

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const user = userResult.rows[0];

            if (!user.is_active) {
                throw new Error('Account is deactivated');
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password + user.salt, user.password_hash);
            if (!isValidPassword) {
                throw new Error('Invalid password');
            }

            // Check if 2FA is enabled
            if (user.two_factor_secret) {
                return {
                    requiresTwoFactor: true,
                    tempToken: this.generateTempToken(user.id)
                };
            }

            // Generate tokens
            const tokens = await this.generateTokens(user, deviceInfo, rememberMe);

            // Update last login
            await this.pool.query(`
                UPDATE users SET last_login = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [user.id]);

            return {
                success: true,
                user: this.sanitizeUser(user),
                tokens
            };

        } catch (error) {
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    // Two-Factor Authentication setup
    async setupTwoFactor(userId) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const secret = speakeasy.generateSecret({
                name: `Talk pAI (${user.nickname})`,
                issuer: 'Talk pAI',
                length: 32
            });

            // Generate QR code
            const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

            // Store temporary secret (not activated until verified)
            await this.pool.query(`
                UPDATE users SET two_factor_temp_secret = $1 WHERE id = $2
            `, [secret.base32, userId]);

            return {
                secret: secret.base32,
                qrCode: qrCodeUrl,
                backupCodes: this.generateBackupCodes()
            };

        } catch (error) {
            throw new Error(`2FA setup failed: ${error.message}`);
        }
    }

    // Verify and activate 2FA
    async verifyTwoFactor(userId, token, backupCodes) {
        try {
            const userResult = await this.pool.query(
                'SELECT two_factor_temp_secret FROM users WHERE id = $1',
                [userId]
            );

            const user = userResult.rows[0];
            if (!user || !user.two_factor_temp_secret) {
                throw new Error('No pending 2FA setup found');
            }

            // Verify token
            const verified = speakeasy.totp.verify({
                secret: user.two_factor_temp_secret,
                encoding: 'base32',
                token,
                window: 2
            });

            if (!verified) {
                throw new Error('Invalid verification code');
            }

            // Activate 2FA
            const hashedBackupCodes = backupCodes.map(code =>
                crypto.createHash('sha256').update(code).digest('hex')
            );

            await this.pool.query(`
                UPDATE users SET
                    two_factor_secret = $1,
                    two_factor_backup_codes = $2,
                    two_factor_temp_secret = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [user.two_factor_temp_secret, JSON.stringify(hashedBackupCodes), userId]);

            return { success: true };

        } catch (error) {
            throw new Error(`2FA verification failed: ${error.message}`);
        }
    }

    // Verify 2FA during login
    async verifyTwoFactorLogin(tempToken, token) {
        try {
            const decoded = jwt.verify(tempToken, this.jwtSecret + 'temp');
            const userId = decoded.userId;

            const userResult = await this.pool.query(
                'SELECT * FROM users WHERE id = $1',
                [userId]
            );

            const user = userResult.rows[0];
            if (!user) {
                throw new Error('User not found');
            }

            // Check if it's a backup code
            if (token.length === 8 && /^[A-Z0-9]{8}$/.test(token)) {
                return await this.verifyBackupCode(user, token);
            }

            // Verify TOTP token
            const verified = speakeasy.totp.verify({
                secret: user.two_factor_secret,
                encoding: 'base32',
                token,
                window: 2
            });

            if (!verified) {
                throw new Error('Invalid verification code');
            }

            // Generate session tokens
            const tokens = await this.generateTokens(user);

            return {
                success: true,
                user: this.sanitizeUser(user),
                tokens
            };

        } catch (error) {
            throw new Error(`2FA login verification failed: ${error.message}`);
        }
    }

    // Password reset functionality
    async requestPasswordReset(email) {
        try {
            const userResult = await this.pool.query(
                'SELECT id, nickname, email FROM users WHERE email = $1 AND is_active = true',
                [email]
            );

            if (userResult.rows.length === 0) {
                // Don't reveal if email exists
                return { success: true };
            }

            const user = userResult.rows[0];
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpires = new Date(Date.now() + 3600000); // 1 hour

            // Store reset token
            await this.pool.query(`
                UPDATE users SET
                    password_reset_token = $1,
                    password_reset_expires = $2
                WHERE id = $3
            `, [resetToken, resetExpires, user.id]);

            // Send reset email
            await this.sendPasswordResetEmail(user, resetToken);

            return { success: true };

        } catch (error) {
            throw new Error(`Password reset request failed: ${error.message}`);
        }
    }

    // Reset password with token
    async resetPassword(token, newPassword) {
        try {
            if (!this.validatePassword(newPassword)) {
                throw new Error('Password does not meet requirements');
            }

            const userResult = await this.pool.query(`
                SELECT id, salt FROM users
                WHERE password_reset_token = $1
                AND password_reset_expires > CURRENT_TIMESTAMP
                AND is_active = true
            `, [token]);

            if (userResult.rows.length === 0) {
                throw new Error('Invalid or expired reset token');
            }

            const user = userResult.rows[0];
            const passwordHash = await bcrypt.hash(newPassword + user.salt, 12);

            // Update password and clear reset token
            await this.pool.query(`
                UPDATE users SET
                    password_hash = $1,
                    password_reset_token = NULL,
                    password_reset_expires = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [passwordHash, user.id]);

            // Invalidate all sessions
            await this.pool.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [user.id]);

            return { success: true };

        } catch (error) {
            throw new Error(`Password reset failed: ${error.message}`);
        }
    }

    // OAuth integration (Google, Microsoft, Apple)
    async handleOAuthCallback(provider, profile) {
        try {
            const email = profile.emails[0].value;

            // Check if user exists
            let userResult = await this.pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );

            let user;
            if (userResult.rows.length === 0) {
                // Create new user
                const nickname = await this.generateUniqueNickname(profile.displayName || profile.name.givenName);

                userResult = await this.pool.query(`
                    INSERT INTO users (nickname, email, display_name, is_verified, avatar)
                    VALUES ($1, $2, $3, true, $4)
                    RETURNING *
                `, [nickname, email, profile.displayName, profile.photos[0]?.value]);

                user = userResult.rows[0];

                // Create user settings
                await this.pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
            } else {
                user = userResult.rows[0];
            }

            // Store OAuth info
            await this.pool.query(`
                INSERT INTO user_oauth (user_id, provider, provider_id, profile_data)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, provider) DO UPDATE SET
                    provider_id = $3,
                    profile_data = $4,
                    updated_at = CURRENT_TIMESTAMP
            `, [user.id, provider, profile.id, JSON.stringify(profile)]);

            const tokens = await this.generateTokens(user);

            return {
                success: true,
                user: this.sanitizeUser(user),
                tokens
            };

        } catch (error) {
            throw new Error(`OAuth callback failed: ${error.message}`);
        }
    }

    // Session management
    async generateTokens(user, deviceInfo = {}, rememberMe = false) {
        const tokenExpiry = rememberMe ? '30d' : '7d';
        const refreshExpiry = rememberMe ? '90d' : '30d';

        const accessToken = jwt.sign(
            {
                userId: user.id,
                nickname: user.nickname,
                role: user.is_admin ? 'admin' : 'user'
            },
            this.jwtSecret,
            { expiresIn: tokenExpiry }
        );

        const refreshToken = jwt.sign(
            { userId: user.id, type: 'refresh' },
            this.jwtRefreshSecret,
            { expiresIn: refreshExpiry }
        );

        // Store session in database
        await this.pool.query(`
            INSERT INTO sessions (user_id, token, refresh_token, user_agent, ip_address, device_info)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            user.id,
            crypto.createHash('sha256').update(accessToken).digest('hex'),
            crypto.createHash('sha256').update(refreshToken).digest('hex'),
            deviceInfo.userAgent,
            deviceInfo.ip,
            JSON.stringify(deviceInfo)
        ]);

        return {
            accessToken,
            refreshToken,
            expiresIn: rememberMe ? 2592000 : 604800 // seconds
        };
    }

    // Refresh token
    async refreshToken(refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);
            const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

            const sessionResult = await this.pool.query(`
                SELECT s.*, u.* FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.refresh_token = $1 AND s.is_active = true AND s.refresh_expires_at > CURRENT_TIMESTAMP
            `, [hashedToken]);

            if (sessionResult.rows.length === 0) {
                throw new Error('Invalid refresh token');
            }

            const user = sessionResult.rows[0];
            const newTokens = await this.generateTokens(user);

            // Update session with new tokens
            await this.pool.query(`
                UPDATE sessions SET
                    token = $1,
                    refresh_token = $2,
                    last_used_at = CURRENT_TIMESTAMP
                WHERE refresh_token = $3
            `, [
                crypto.createHash('sha256').update(newTokens.accessToken).digest('hex'),
                crypto.createHash('sha256').update(newTokens.refreshToken).digest('hex'),
                hashedToken
            ]);

            return {
                success: true,
                tokens: newTokens
            };

        } catch (error) {
            throw new Error(`Token refresh failed: ${error.message}`);
        }
    }

    // Logout and session management
    async logout(token) {
        try {
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            await this.pool.query(
                'UPDATE sessions SET is_active = false WHERE token = $1',
                [hashedToken]
            );

            return { success: true };

        } catch (error) {
            throw new Error(`Logout failed: ${error.message}`);
        }
    }

    async logoutAllDevices(userId) {
        try {
            await this.pool.query(
                'UPDATE sessions SET is_active = false WHERE user_id = $1',
                [userId]
            );

            return { success: true };

        } catch (error) {
            throw new Error(`Logout all devices failed: ${error.message}`);
        }
    }

    // Helper methods
    validateNickname(nickname) {
        return /^[a-zA-Z0-9_]{3,50}$/.test(nickname);
    }

    validateEmail(email) {
        return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
    }

    validatePassword(password) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
    }

    sanitizeUser(user) {
        const { password_hash, salt, two_factor_secret, two_factor_backup_codes, ...sanitized } = user;
        return sanitized;
    }

    generateTempToken(userId) {
        return jwt.sign({ userId, type: 'temp' }, this.jwtSecret + 'temp', { expiresIn: '10m' });
    }

    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }

    async getUserById(userId) {
        const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        return result.rows[0];
    }

    async generateUniqueNickname(baseName) {
        const base = baseName.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 30);
        let nickname = base;
        let counter = 1;

        while (true) {
            const existing = await this.pool.query('SELECT id FROM users WHERE nickname = $1', [nickname]);
            if (existing.rows.length === 0) {
                return nickname;
            }
            nickname = `${base}${counter}`;
            counter++;
        }
    }

    async verifyBackupCode(user, code) {
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
        const backupCodes = JSON.parse(user.two_factor_backup_codes || '[]');

        const codeIndex = backupCodes.indexOf(hashedCode);
        if (codeIndex === -1) {
            throw new Error('Invalid backup code');
        }

        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        await this.pool.query(
            'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
            [JSON.stringify(backupCodes), user.id]
        );

        const tokens = await this.generateTokens(user);
        return {
            success: true,
            user: this.sanitizeUser(user),
            tokens,
            warningMessage: `Backup code used. ${backupCodes.length} codes remaining.`
        };
    }

    async sendVerificationEmail(user) {
        const verificationToken = crypto.randomBytes(32).toString('hex');

        await this.pool.query(
            'UPDATE users SET email_verification_token = $1 WHERE id = $2',
            [verificationToken, user.id]
        );

        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        await this.mailer.sendMail({
            from: process.env.SMTP_FROM || 'noreply@talkpai.com',
            to: user.email,
            subject: 'Verify your Talk pAI account',
            html: `
                <h2>Welcome to Talk pAI!</h2>
                <p>Please click the link below to verify your email address:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
            `
        });
    }

    async sendPasswordResetEmail(user, token) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

        await this.mailer.sendMail({
            from: process.env.SMTP_FROM || 'noreply@talkpai.com',
            to: user.email,
            subject: 'Password Reset - Talk pAI',
            html: `
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this reset, please ignore this email.</p>
            `
        });
    }

    // Rate limiting middleware
    static createLoginLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // limit each IP to 5 requests per windowMs
            message: 'Too many login attempts, please try again later',
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    static createRegistrationLimiter() {
        return rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3, // limit each IP to 3 registrations per hour
            message: 'Too many registration attempts, please try again later',
            standardHeaders: true,
            legacyHeaders: false
        });
    }
}

module.exports = EnhancedAuthService;