-- Simple contacts schema for Talk pAI
-- Only create missing tables needed for contacts functionality

-- User contacts table (for contacts API compatibility)
CREATE TABLE IF NOT EXISTS user_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    contact_user_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'accepted',
    nickname VARCHAR(100),
    notes TEXT,
    tags TEXT[],
    is_favorite BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    last_interaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, contact_user_id)
);

-- Friend requests table
CREATE TABLE IF NOT EXISTS friend_requests (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL DEFAULT 1,
    to_user_id INTEGER NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,

    UNIQUE(from_user_id, to_user_id)
);

-- Blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    blocked_user_id INTEGER NOT NULL,
    reason TEXT,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, blocked_user_id)
);

-- User search history
CREATE TABLE IF NOT EXISTS user_search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    search_query VARCHAR(255),
    search_type VARCHAR(50) DEFAULT 'user',
    results_count INTEGER DEFAULT 0,
    searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User discovery settings
CREATE TABLE IF NOT EXISTS user_discovery (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
    searchable BOOLEAN DEFAULT TRUE,
    discoverable BOOLEAN DEFAULT TRUE,
    show_online_status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User directory for enhanced search
CREATE TABLE IF NOT EXISTS user_directory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
    verification_level VARCHAR(20) DEFAULT 'none',
    rating DECIMAL(3,2) DEFAULT 0.00,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User search index for full-text search
CREATE TABLE IF NOT EXISTS user_search_index (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
    keywords TEXT,
    search_vector tsvector,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Simple users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    bio TEXT DEFAULT 'Hey there! I am using Talk pAI.',
    avatar_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'online',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    department VARCHAR(100),
    position VARCHAR(100),
    location VARCHAR(100),
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo users if they don't exist
INSERT INTO users (nickname, display_name, email, bio, is_verified, department, position)
VALUES
    ('alice', 'Alice Johnson', 'alice@talkpai.com', 'Frontend Developer passionate about UI/UX', true, 'Engineering', 'Senior Frontend Developer'),
    ('bob', 'Bob Smith', 'bob@talkpai.com', 'Backend Engineer focused on scalable systems', true, 'Engineering', 'Backend Engineer'),
    ('carol', 'Carol Brown', 'carol@talkpai.com', 'Product Manager driving innovation', false, 'Product', 'Product Manager'),
    ('david', 'David Wilson', 'david@talkpai.com', 'DevOps specialist ensuring reliability', true, 'Engineering', 'DevOps Engineer'),
    ('eve', 'Eve Garcia', 'eve@talkpai.com', 'UX Designer creating amazing experiences', false, 'Design', 'UX Designer')
ON CONFLICT (nickname) DO NOTHING;

-- Insert discovery settings for demo users
INSERT INTO user_discovery (user_id, searchable, discoverable)
SELECT id, true, true FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Insert directory entries for demo users
INSERT INTO user_directory (user_id, verification_level, rating, review_count)
SELECT id,
    CASE WHEN is_verified THEN 'email' ELSE 'none' END,
    ROUND((RANDOM() * 4 + 1)::numeric, 2),
    FLOOR(RANDOM() * 50)::integer
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Insert search index for demo users
INSERT INTO user_search_index (user_id, keywords)
SELECT id,
    LOWER(COALESCE(display_name, '') || ' ' || COALESCE(nickname, '') || ' ' || COALESCE(bio, '') || ' ' || COALESCE(department, '') || ' ' || COALESCE(position, ''))
FROM users
ON CONFLICT (user_id) DO NOTHING;

COMMIT;