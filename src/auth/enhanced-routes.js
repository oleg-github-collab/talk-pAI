const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const EnhancedAuthService = require('./enhanced-auth-service');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const authService = new EnhancedAuthService();

// Apply rate limiting to sensitive endpoints
const loginLimiter = EnhancedAuthService.createLoginLimiter();
const registrationLimiter = EnhancedAuthService.createRegistrationLimiter();

// Enhanced user registration
router.post('/register', registrationLimiter, async (req, res) => {
    try {
        const { nickname, email, password, displayName } = req.body;

        if (!nickname || !password) {
            return res.status(400).json({
                success: false,
                message: 'Nickname and password are required'
            });
        }

        const result = await authService.registerUser({
            nickname,
            email,
            password,
            displayName
        });

        res.status(201).json(result);

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Enhanced login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { identifier, password, rememberMe = false } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Identifier and password are required'
            });
        }

        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ip: req.ip || req.connection.remoteAddress,
            platform: req.headers['sec-ch-ua-platform'],
            mobile: req.headers['sec-ch-ua-mobile'] === '?1'
        };

        const result = await authService.loginUser({
            identifier,
            password,
            deviceInfo,
            rememberMe
        });

        if (result.requiresTwoFactor) {
            return res.json({
                success: true,
                requiresTwoFactor: true,
                tempToken: result.tempToken
            });
        }

        // Set HTTP-only cookie for refresh token
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: result.tokens.expiresIn * 1000
        });

        res.json({
            success: true,
            user: result.user,
            accessToken: result.tokens.accessToken,
            expiresIn: result.tokens.expiresIn
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Two-factor authentication setup
router.post('/2fa/setup', authMiddleware, async (req, res) => {
    try {
        const result = await authService.setupTwoFactor(req.user.id);
        res.json(result);

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Verify 2FA setup
router.post('/2fa/verify-setup', authMiddleware, async (req, res) => {
    try {
        const { token, backupCodes } = req.body;

        if (!token || !backupCodes) {
            return res.status(400).json({
                success: false,
                message: 'Verification code and backup codes are required'
            });
        }

        const result = await authService.verifyTwoFactor(req.user.id, token, backupCodes);
        res.json(result);

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Verify 2FA during login
router.post('/2fa/verify-login', async (req, res) => {
    try {
        const { tempToken, token } = req.body;

        if (!tempToken || !token) {
            return res.status(400).json({
                success: false,
                message: 'Temporary token and verification code are required'
            });
        }

        const result = await authService.verifyTwoFactorLogin(tempToken, token);

        if (result.success) {
            res.cookie('refreshToken', result.tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: result.tokens.expiresIn * 1000
            });

            res.json({
                success: true,
                user: result.user,
                accessToken: result.tokens.accessToken,
                expiresIn: result.tokens.expiresIn,
                warningMessage: result.warningMessage
            });
        }

    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Disable 2FA
router.post('/2fa/disable', authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required to disable 2FA'
            });
        }

        // Verify password before disabling 2FA
        const loginResult = await authService.loginUser({
            identifier: req.user.nickname,
            password
        });

        if (!loginResult.success) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }

        await authService.pool.query(`
            UPDATE users SET
                two_factor_secret = NULL,
                two_factor_backup_codes = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [req.user.id]);

        res.json({ success: true });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Password reset request
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        await authService.requestPasswordReset(email);

        res.json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent'
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        const result = await authService.resetPassword(token, password);
        res.json(result);

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Change password (authenticated user)
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        // Verify current password
        const loginResult = await authService.loginUser({
            identifier: req.user.nickname,
            password: currentPassword
        });

        if (!loginResult.success) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        const result = await authService.changePassword(req.user.id, newPassword);
        res.json(result);

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Email verification
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Verification token is required'
            });
        }

        const result = await authService.verifyEmail(token);
        res.json(result);

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        const result = await authService.refreshToken(refreshToken);

        if (result.success) {
            res.cookie('refreshToken', result.tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: result.tokens.expiresIn * 1000
            });

            res.json({
                success: true,
                accessToken: result.tokens.accessToken,
                expiresIn: result.tokens.expiresIn
            });
        }

    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (token) {
            await authService.logout(token);
        }

        res.clearCookie('refreshToken');
        res.json({ success: true });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Logout from all devices
router.post('/logout-all', authMiddleware, async (req, res) => {
    try {
        await authService.logoutAllDevices(req.user.id);
        res.clearCookie('refreshToken');
        res.json({ success: true });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get active sessions
router.get('/sessions', authMiddleware, async (req, res) => {
    try {
        const result = await authService.pool.query(`
            SELECT
                id,
                user_agent,
                ip_address,
                device_info,
                created_at,
                last_used_at,
                expires_at
            FROM sessions
            WHERE user_id = $1 AND is_active = true
            ORDER BY last_used_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            sessions: result.rows
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Terminate specific session
router.delete('/sessions/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;

        await authService.pool.query(`
            UPDATE sessions SET is_active = false
            WHERE id = $1 AND user_id = $2
        `, [sessionId, req.user.id]);

        res.json({ success: true });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Configure OAuth strategies
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const result = await authService.handleOAuthCallback('google', profile);
            return done(null, result);
        } catch (error) {
            return done(error);
        }
    }));

    // Google OAuth routes
    router.get('/google',
        passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    router.get('/google/callback',
        passport.authenticate('google', { failureRedirect: '/login' }),
        (req, res) => {
            const { user, tokens } = req.user;

            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: tokens.expiresIn * 1000
            });

            const redirectUrl = `${process.env.FRONTEND_URL}/oauth-success?token=${tokens.accessToken}`;
            res.redirect(redirectUrl);
        }
    );
}

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: "/auth/microsoft/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const result = await authService.handleOAuthCallback('microsoft', profile);
            return done(null, result);
        } catch (error) {
            return done(error);
        }
    }));

    // Microsoft OAuth routes
    router.get('/microsoft',
        passport.authenticate('microsoft', { scope: ['user.read'] })
    );

    router.get('/microsoft/callback',
        passport.authenticate('microsoft', { failureRedirect: '/login' }),
        (req, res) => {
            const { user, tokens } = req.user;

            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: tokens.expiresIn * 1000
            });

            const redirectUrl = `${process.env.FRONTEND_URL}/oauth-success?token=${tokens.accessToken}`;
            res.redirect(redirectUrl);
        }
    );
}

// User profile endpoints
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const result = await authService.pool.query(`
            SELECT u.*, us.* FROM users u
            LEFT JOIN user_settings us ON u.id = us.user_id
            WHERE u.id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = authService.sanitizeUser(result.rows[0]);
        res.json({
            success: true,
            user
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { displayName, bio, status, theme } = req.body;

        const result = await authService.pool.query(`
            UPDATE users SET
                display_name = COALESCE($1, display_name),
                bio = COALESCE($2, bio),
                status = COALESCE($3, status),
                theme = COALESCE($4, theme),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
        `, [displayName, bio, status, theme, req.user.id]);

        const user = authService.sanitizeUser(result.rows[0]);
        res.json({
            success: true,
            user
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;