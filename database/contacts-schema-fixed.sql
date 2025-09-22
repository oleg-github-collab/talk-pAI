-- Fixed contacts schema for Talk pAI with UUID support
-- Create missing tables needed for contacts functionality

-- User contacts table (for contacts API compatibility)
CREATE TABLE user_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    contact_user_id UUID NOT NULL,
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
CREATE TABLE friend_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID NOT NULL,
    to_user_id UUID NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,

    UNIQUE(from_user_id, to_user_id)
);

-- Blocked users table
CREATE TABLE blocked_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    blocked_user_id UUID NOT NULL,
    reason TEXT,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, blocked_user_id)
);

-- User search history
CREATE TABLE user_search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    search_query VARCHAR(255),
    search_type VARCHAR(50) DEFAULT 'user',
    results_count INTEGER DEFAULT 0,
    searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User discovery settings
CREATE TABLE user_discovery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    searchable BOOLEAN DEFAULT TRUE,
    discoverable BOOLEAN DEFAULT TRUE,
    show_online_status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User directory for enhanced search
CREATE TABLE user_directory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    verification_level VARCHAR(20) DEFAULT 'none',
    rating DECIMAL(3,2) DEFAULT 0.00,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User search index for full-text search
CREATE TABLE user_search_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    keywords TEXT,
    search_vector tsvector,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert discovery settings for existing users
INSERT INTO user_discovery (user_id, searchable, discoverable)
SELECT id, true, true FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Insert directory entries for existing users
INSERT INTO user_directory (user_id, verification_level, rating, review_count)
SELECT id,
    CASE WHEN is_verified THEN 'email' ELSE 'none' END,
    ROUND((RANDOM() * 4 + 1)::numeric, 2),
    FLOOR(RANDOM() * 50)::integer
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Insert search index for existing users
INSERT INTO user_search_index (user_id, keywords)
SELECT id,
    LOWER(COALESCE(display_name, '') || ' ' || COALESCE(nickname, '') || ' ' || COALESCE(bio, ''))
FROM users
ON CONFLICT (user_id) DO NOTHING;