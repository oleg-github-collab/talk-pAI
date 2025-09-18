-- Enhanced Contacts and Search Schema for Talk pAI

-- Enhanced user contacts with more features
CREATE TABLE IF NOT EXISTS user_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked, favorite
    nickname VARCHAR(100), -- Custom nickname for contact
    notes TEXT, -- Private notes about contact
    tags JSONB DEFAULT '[]', -- Tags like 'work', 'family', 'friend'
    is_favorite BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    last_interaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, contact_user_id)
);

-- Contact groups for organizing contacts
CREATE TABLE IF NOT EXISTS contact_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(10) DEFAULT '#667eea',
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many relationship between contacts and groups
CREATE TABLE IF NOT EXISTS contact_group_members (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES user_contacts(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES contact_groups(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contact_id, group_id)
);

-- User search and discovery
CREATE TABLE IF NOT EXISTS user_discovery (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    searchable BOOLEAN DEFAULT TRUE, -- Can others find this user
    discoverable_by VARCHAR(20) DEFAULT 'everyone', -- everyone, contacts, nobody
    allow_friend_requests BOOLEAN DEFAULT TRUE,
    public_profile BOOLEAN DEFAULT TRUE,
    show_in_directory BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friend requests
CREATE TABLE IF NOT EXISTS friend_requests (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined, cancelled
    message TEXT, -- Optional message with request
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_user_id, to_user_id)
);

-- User directory for public discovery
CREATE TABLE IF NOT EXISTS user_directory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    bio_public TEXT, -- Public version of bio
    skills_public JSONB DEFAULT '[]',
    interests_public JSONB DEFAULT '[]',
    social_links JSONB DEFAULT '{}',
    verification_level VARCHAR(20) DEFAULT 'none', -- none, email, phone, verified
    rating DECIMAL(3,2) DEFAULT 5.0,
    review_count INTEGER DEFAULT 0,
    last_active_public TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Contact interaction history
CREATE TABLE IF NOT EXISTS contact_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20), -- message, call, video_call, file_share
    interaction_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blocked users
CREATE TABLE IF NOT EXISTS blocked_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, blocked_user_id)
);

-- User search history
CREATE TABLE IF NOT EXISTS user_search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    search_query VARCHAR(255),
    search_type VARCHAR(20), -- user, message, file, all
    results_count INTEGER DEFAULT 0,
    searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Global user search index
CREATE TABLE IF NOT EXISTS user_search_index (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    searchable_content TEXT, -- Combination of display_name, bio, skills, etc.
    keywords TSVECTOR, -- Full-text search keywords
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_contact_user_id ON user_contacts(contact_user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_status ON user_contacts(status);
CREATE INDEX IF NOT EXISTS idx_user_contacts_is_favorite ON user_contacts(is_favorite);

CREATE INDEX IF NOT EXISTS idx_contact_groups_user_id ON contact_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_contact_id ON contact_group_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_group_id ON contact_group_members(group_id);

CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

CREATE INDEX IF NOT EXISTS idx_user_directory_is_public ON user_directory(is_public);
CREATE INDEX IF NOT EXISTS idx_user_directory_verification ON user_directory(verification_level);

CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);

CREATE INDEX IF NOT EXISTS idx_user_search_index_keywords ON user_search_index USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_user_search_index_content ON user_search_index USING gin(to_tsvector('english', searchable_content));

-- Functions for search
CREATE OR REPLACE FUNCTION update_user_search_index()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_search_index (user_id, searchable_content, keywords)
    VALUES (
        NEW.id,
        CONCAT_WS(' ', NEW.display_name, NEW.nickname, NEW.bio, NEW.department, NEW.position, NEW.location),
        to_tsvector('english', CONCAT_WS(' ', NEW.display_name, NEW.nickname, NEW.bio, NEW.department, NEW.position, NEW.location))
    )
    ON CONFLICT (user_id) DO UPDATE SET
        searchable_content = CONCAT_WS(' ', NEW.display_name, NEW.nickname, NEW.bio, NEW.department, NEW.position, NEW.location),
        keywords = to_tsvector('english', CONCAT_WS(' ', NEW.display_name, NEW.nickname, NEW.bio, NEW.department, NEW.position, NEW.location)),
        updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search index when user data changes
CREATE TRIGGER trigger_update_user_search_index
    AFTER INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_search_index();

-- Insert default discovery settings for existing users
INSERT INTO user_discovery (user_id, searchable, discoverable_by, allow_friend_requests, public_profile, show_in_directory)
SELECT id, TRUE, 'everyone', TRUE, TRUE, TRUE
FROM users
WHERE id NOT IN (SELECT user_id FROM user_discovery WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;