const express = require('express');

class ContactsAPI {
    constructor(database, logger) {
        this.database = database;
        this.logger = logger || { info: console.log, error: console.error, warn: console.warn };
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // Get user's contacts
        this.router.get('/', async (req, res) => {
            try {
                const userId = req.user?.id || 1; // Temp fallback
                const { status = 'accepted', search, group, limit = 50, offset = 0 } = req.query;

                let query = `
                    SELECT
                        uc.id as contact_id,
                        uc.status,
                        uc.nickname as custom_nickname,
                        uc.notes,
                        uc.tags,
                        uc.is_favorite,
                        uc.is_pinned,
                        uc.last_interaction_at,
                        u.id as user_id,
                        u.display_name,
                        u.nickname,
                        u.bio,
                        u.avatar_url,
                        u.status as user_status,
                        u.status_message,
                        u.last_seen_at,
                        u.department,
                        u.position
                    FROM user_contacts uc
                    JOIN users u ON uc.contact_user_id = u.id
                    WHERE uc.user_id = $1
                `;

                const params = [userId];
                let paramCount = 1;

                if (status && status !== 'all') {
                    paramCount++;
                    query += ` AND uc.status = $${paramCount}`;
                    params.push(status);
                }

                if (search) {
                    paramCount++;
                    query += ` AND (
                        u.display_name ILIKE $${paramCount} OR
                        u.nickname ILIKE $${paramCount} OR
                        uc.nickname ILIKE $${paramCount} OR
                        u.bio ILIKE $${paramCount}
                    )`;
                    params.push(`%${search}%`);
                }

                query += ` ORDER BY
                    uc.is_pinned DESC,
                    uc.is_favorite DESC,
                    uc.last_interaction_at DESC NULLS LAST,
                    u.display_name ASC
                `;

                if (limit) {
                    paramCount++;
                    query += ` LIMIT $${paramCount}`;
                    params.push(limit);
                }

                if (offset) {
                    paramCount++;
                    query += ` OFFSET $${paramCount}`;
                    params.push(offset);
                }

                const result = await this.database.query(query, params);

                res.json({
                    success: true,
                    data: result.rows,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        total: result.rowCount
                    }
                });

            } catch (error) {
                this.logger.error('Get contacts error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch contacts'
                });
            }
        });

        // Search users globally
        this.router.get('/search/users', async (req, res) => {
            try {
                const userId = req.user?.id || 1;
                const { q: query, limit = 20, offset = 0, verified_only = false } = req.query;

                if (!query || query.length < 2) {
                    return res.json({
                        success: true,
                        data: [],
                        message: 'Query too short'
                    });
                }

                // Save search to history
                await this.database.query(
                    'INSERT INTO user_search_history (user_id, search_query, search_type) VALUES ($1, $2, $3)',
                    [userId, query, 'user']
                );

                let searchQuery = `
                    SELECT DISTINCT
                        u.id,
                        u.display_name,
                        u.nickname,
                        u.bio,
                        u.avatar_url,
                        u.department,
                        u.position,
                        u.location,
                        u.is_verified,
                        ud.verification_level,
                        ud.rating,
                        ud.review_count,
                        uc.status as contact_status,
                        CASE
                            WHEN uc.id IS NOT NULL THEN true
                            ELSE false
                        END as is_contact,
                        CASE
                            WHEN bu.id IS NOT NULL THEN true
                            ELSE false
                        END as is_blocked
                    FROM users u
                    LEFT JOIN user_discovery disc ON u.id = disc.user_id
                    LEFT JOIN user_directory ud ON u.id = ud.user_id
                    LEFT JOIN user_contacts uc ON (u.id = uc.contact_user_id AND uc.user_id = $1)
                    LEFT JOIN blocked_users bu ON (u.id = bu.blocked_user_id AND bu.user_id = $1)
                    LEFT JOIN user_search_index usi ON u.id = usi.user_id
                    WHERE u.id != $1
                    AND u.is_active = true
                    AND (disc.searchable = true OR disc.searchable IS NULL)
                    AND bu.id IS NULL
                    AND (
                        u.display_name ILIKE $2 OR
                        u.nickname ILIKE $2 OR
                        u.bio ILIKE $2 OR
                        u.department ILIKE $2 OR
                        u.position ILIKE $2 OR
                        usi.keywords @@ plainto_tsquery('english', $3)
                    )
                `;

                const params = [userId, `%${query}%`, query];
                let paramCount = 3;

                if (verified_only === 'true') {
                    paramCount++;
                    searchQuery += ` AND (u.is_verified = true OR ud.verification_level != 'none')`;
                }

                searchQuery += ` ORDER BY
                    is_contact DESC,
                    u.is_verified DESC,
                    ud.rating DESC NULLS LAST,
                    similarity(u.display_name, $3) DESC,
                    u.display_name ASC
                `;

                if (limit) {
                    paramCount++;
                    searchQuery += ` LIMIT $${paramCount}`;
                    params.push(limit);
                }

                if (offset) {
                    paramCount++;
                    searchQuery += ` OFFSET $${paramCount}`;
                    params.push(offset);
                }

                const result = await this.database.query(searchQuery, params);

                // Update search result count
                await this.database.query(
                    'UPDATE user_search_history SET results_count = $1 WHERE user_id = $2 AND search_query = $3 AND search_type = $4 ORDER BY searched_at DESC LIMIT 1',
                    [result.rowCount, userId, query, 'user']
                );

                res.json({
                    success: true,
                    data: result.rows,
                    query: query,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        total: result.rowCount
                    }
                });

            } catch (error) {
                this.logger.error('User search error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Search failed'
                });
            }
        });

        // Add contact/Send friend request
        this.router.post('/add', async (req, res) => {
            try {
                const userId = req.user?.id || 1;
                const { user_id: contactUserId, message = '' } = req.body;

                if (!contactUserId) {
                    return res.status(400).json({
                        success: false,
                        error: 'User ID is required'
                    });
                }

                // Check if already in contacts
                const existingContact = await this.database.query(
                    'SELECT id, status FROM user_contacts WHERE user_id = $1 AND contact_user_id = $2',
                    [userId, contactUserId]
                );

                if (existingContact.rows.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'User is already in your contacts',
                        current_status: existingContact.rows[0].status
                    });
                }

                // Check if user is blocked
                const isBlocked = await this.database.query(
                    'SELECT id FROM blocked_users WHERE (user_id = $1 AND blocked_user_id = $2) OR (user_id = $2 AND blocked_user_id = $1)',
                    [userId, contactUserId]
                );

                if (isBlocked.rows.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot add this user'
                    });
                }

                // Create friend request
                await this.database.query(`
                    INSERT INTO friend_requests (from_user_id, to_user_id, message)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET
                        message = $3,
                        created_at = CURRENT_TIMESTAMP,
                        status = 'pending'
                `, [userId, contactUserId, message]);

                res.json({
                    success: true,
                    message: 'Friend request sent successfully'
                });

            } catch (error) {
                this.logger.error('Add contact error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to send friend request'
                });
            }
        });

        // Get friend requests
        this.router.get('/requests', async (req, res) => {
            try {
                const userId = req.user?.id || 1;
                const { type = 'received' } = req.query; // received, sent

                let query;
                if (type === 'sent') {
                    query = `
                        SELECT
                            fr.id,
                            fr.status,
                            fr.message,
                            fr.created_at,
                            fr.responded_at,
                            u.id as user_id,
                            u.display_name,
                            u.nickname,
                            u.avatar_url,
                            u.bio
                        FROM friend_requests fr
                        JOIN users u ON fr.to_user_id = u.id
                        WHERE fr.from_user_id = $1
                        ORDER BY fr.created_at DESC
                    `;
                } else {
                    query = `
                        SELECT
                            fr.id,
                            fr.status,
                            fr.message,
                            fr.created_at,
                            fr.responded_at,
                            u.id as user_id,
                            u.display_name,
                            u.nickname,
                            u.avatar_url,
                            u.bio
                        FROM friend_requests fr
                        JOIN users u ON fr.from_user_id = u.id
                        WHERE fr.to_user_id = $1
                        ORDER BY fr.created_at DESC
                    `;
                }

                const result = await this.database.query(query, [userId]);

                res.json({
                    success: true,
                    data: result.rows,
                    type: type
                });

            } catch (error) {
                this.logger.error('Get friend requests error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch friend requests'
                });
            }
        });

        // Respond to friend request
        this.router.put('/requests/:requestId/respond', async (req, res) => {
            try {
                const userId = req.user?.id || 1;
                const { requestId } = req.params;
                const { action } = req.body; // accept, decline

                if (!['accept', 'decline'].includes(action)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid action'
                    });
                }

                // Get the friend request
                const request = await this.database.query(
                    'SELECT * FROM friend_requests WHERE id = $1 AND to_user_id = $2 AND status = $3',
                    [requestId, userId, 'pending']
                );

                if (request.rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Friend request not found'
                    });
                }

                const fromUserId = request.rows[0].from_user_id;

                if (action === 'accept') {
                    // Add both users to each other's contacts
                    await this.database.query('BEGIN');

                    await this.database.query(`
                        INSERT INTO user_contacts (user_id, contact_user_id, status, last_interaction_at)
                        VALUES ($1, $2, 'accepted', CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, contact_user_id) DO UPDATE SET
                            status = 'accepted',
                            last_interaction_at = CURRENT_TIMESTAMP
                    `, [userId, fromUserId]);

                    await this.database.query(`
                        INSERT INTO user_contacts (user_id, contact_user_id, status, last_interaction_at)
                        VALUES ($1, $2, 'accepted', CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, contact_user_id) DO UPDATE SET
                            status = 'accepted',
                            last_interaction_at = CURRENT_TIMESTAMP
                    `, [fromUserId, userId]);

                    await this.database.query('COMMIT');
                }

                // Update friend request status
                await this.database.query(
                    'UPDATE friend_requests SET status = $1, responded_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [action === 'accept' ? 'accepted' : 'declined', requestId]
                );

                res.json({
                    success: true,
                    message: `Friend request ${action}ed successfully`
                });

            } catch (error) {
                await this.database.query('ROLLBACK');
                this.logger.error('Respond to friend request error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to respond to friend request'
                });
            }
        });

        // Update contact
        this.router.put('/:contactId', async (req, res) => {
            try {
                const userId = req.user?.id || 1;
                const { contactId } = req.params;
                const { nickname, notes, tags, is_favorite, is_pinned } = req.body;

                const result = await this.database.query(`
                    UPDATE user_contacts SET
                        nickname = COALESCE($1, nickname),
                        notes = COALESCE($2, notes),
                        tags = COALESCE($3, tags),
                        is_favorite = COALESCE($4, is_favorite),
                        is_pinned = COALESCE($5, is_pinned),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $6 AND user_id = $7
                    RETURNING *
                `, [nickname, notes, tags, is_favorite, is_pinned, contactId, userId]);

                if (result.rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Contact not found'
                    });
                }

                res.json({
                    success: true,
                    data: result.rows[0],
                    message: 'Contact updated successfully'
                });

            } catch (error) {
                this.logger.error('Update contact error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to update contact'
                });
            }
        });

        // Remove contact
        this.router.delete('/:contactId', async (req, res) => {
            try {
                const userId = req.user?.id || 1;
                const { contactId } = req.params;

                const contact = await this.database.query(
                    'SELECT contact_user_id FROM user_contacts WHERE id = $1 AND user_id = $2',
                    [contactId, userId]
                );

                if (contact.rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Contact not found'
                    });
                }

                const contactUserId = contact.rows[0].contact_user_id;

                // Remove from both sides
                await this.database.query('BEGIN');

                await this.database.query(
                    'DELETE FROM user_contacts WHERE user_id = $1 AND contact_user_id = $2',
                    [userId, contactUserId]
                );

                await this.database.query(
                    'DELETE FROM user_contacts WHERE user_id = $1 AND contact_user_id = $2',
                    [contactUserId, userId]
                );

                await this.database.query('COMMIT');

                res.json({
                    success: true,
                    message: 'Contact removed successfully'
                });

            } catch (error) {
                await this.database.query('ROLLBACK');
                this.logger.error('Remove contact error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to remove contact'
                });
            }
        });

        // Block user
        this.router.post('/block', async (req, res) => {
            try {
                const userId = req.user?.id || 1;
                const { user_id: blockedUserId, reason = '' } = req.body;

                await this.database.query('BEGIN');

                // Add to blocked users
                await this.database.query(`
                    INSERT INTO blocked_users (user_id, blocked_user_id, reason)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, blocked_user_id) DO UPDATE SET
                        reason = $3,
                        blocked_at = CURRENT_TIMESTAMP
                `, [userId, blockedUserId, reason]);

                // Remove from contacts if exists
                await this.database.query(
                    'DELETE FROM user_contacts WHERE (user_id = $1 AND contact_user_id = $2) OR (user_id = $2 AND contact_user_id = $1)',
                    [userId, blockedUserId]
                );

                await this.database.query('COMMIT');

                res.json({
                    success: true,
                    message: 'User blocked successfully'
                });

            } catch (error) {
                await this.database.query('ROLLBACK');
                this.logger.error('Block user error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to block user'
                });
            }
        });

        // Get search suggestions
        this.router.get('/search/suggestions', async (req, res) => {
            try {
                const userId = req.user?.id || 1;
                const { q: query = '' } = req.query;

                let suggestions = [];

                if (query.length >= 1) {
                    // Get matching contacts
                    const contacts = await this.database.query(`
                        SELECT DISTINCT
                            'contact' as type,
                            u.display_name as title,
                            u.nickname as subtitle,
                            u.avatar_url as icon,
                            u.id as user_id
                        FROM user_contacts uc
                        JOIN users u ON uc.contact_user_id = u.id
                        WHERE uc.user_id = $1
                        AND uc.status = 'accepted'
                        AND (u.display_name ILIKE $2 OR u.nickname ILIKE $2)
                        LIMIT 5
                    `, [userId, `%${query}%`]);

                    suggestions = [...suggestions, ...contacts.rows];
                }

                // Recent searches
                const recentSearches = await this.database.query(`
                    SELECT DISTINCT
                        'recent' as type,
                        search_query as title,
                        'Recent search' as subtitle,
                        '🕐' as icon
                    FROM user_search_history
                    WHERE user_id = $1
                    AND search_query ILIKE $2
                    ORDER BY searched_at DESC
                    LIMIT 3
                `, [userId, `%${query}%`]);

                suggestions = [...suggestions, ...recentSearches.rows];

                res.json({
                    success: true,
                    data: suggestions.slice(0, 8) // Limit total suggestions
                });

            } catch (error) {
                this.logger.error('Search suggestions error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get suggestions'
                });
            }
        });

        // Error handling
        this.router.use((err, req, res, next) => {
            this.logger.error(`Contacts API Error: ${err.message}`);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ContactsAPI;