PRAGMA foreign_keys = ON;

-- ============================================================
-- SITE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    max_threads INTEGER,
    max_posts INTEGER,

    frozen INTEGER NOT NULL DEFAULT 0 CHECK (frozen IN (0, 1)),
    no_new_threads INTEGER NOT NULL DEFAULT 0 CHECK (no_new_threads IN (0, 1)),

    slowmode INTEGER NOT NULL DEFAULT 0 CHECK (slowmode IN (0, 1)),
    slowmode_timer INTEGER,

    new_poster_timer_thread INTEGER,
    new_poster_timer_posts INTEGER,

    post_cooldown_thread INTEGER,
    post_cooldown_post INTEGER,

    posts_per_page INTEGER NOT NULL DEFAULT 20,
    pages INTEGER NOT NULL DEFAULT 1,

    bump_limit INTEGER
);

INSERT OR IGNORE INTO site_settings (id)
VALUES (1);


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    ip TEXT,
    ip_hash TEXT,

    cookie TEXT NOT NULL UNIQUE,
    user_agent_hash TEXT,

    country TEXT,
    country_name TEXT,
    user_role TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    banned INTEGER NOT NULL DEFAULT 0,
    ban_count INTEGER,
    code TEXT,
    pin_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_ip_hash
    ON users(ip_hash);

CREATE INDEX IF NOT EXISTS idx_users_cookie
    ON users(cookie);



-- ============================================================
-- MOSHPITS / BOARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS moshpits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    unique_id TEXT NOT NULL UNIQUE,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    title TEXT CHECK(length(title) <= 7),
    rules TEXT,
    bio TEXT,

    dis INTEGER NOT NULL DEFAULT 0
        CHECK (dis IN (0, 1)),

    hid INTEGER NOT NULL DEFAULT 0
        CHECK (hid IN (0, 1)),

    max_threads INTEGER NOT NULL DEFAULT 150,
    max_posts INTEGER NOT NULL DEFAULT 300,

    frozen INTEGER NOT NULL DEFAULT 0
        CHECK (frozen IN (0, 1)),

    silenced INTEGER NOT NULL DEFAULT 0
        CHECK (silenced IN (0, 1)),

    slowmode INTEGER NOT NULL DEFAULT 0
        CHECK (slowmode IN (0, 1)),

    slowmode_timer INTEGER,

    author_id INTEGER,

    new_poster_timer_thread INTEGER,
    new_poster_timer_posts INTEGER,

    post_cooldown_thread INTEGER,
    post_cooldown_post INTEGER,

    posts_per_page INTEGER,
    pages INTEGER,

    bump_limit INTEGER,

    flags TEXT,

    FOREIGN KEY (author_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_moshpits_unique_id
    ON moshpits(unique_id);

CREATE INDEX IF NOT EXISTS idx_moshpits_author
    ON moshpits(author_id);

CREATE INDEX IF NOT EXISTS idx_moshpits_hid
    ON moshpits(hid);

CREATE INDEX IF NOT EXISTS idx_moshpits_dis
    ON moshpits(dis);


-- ============================================================
-- THREADS
-- ============================================================

CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    post_count INTEGER NOT NULL DEFAULT 0,
    thread_text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER,
    bumped_at INTEGER,
    link INTEGER NOT NULL DEFAULT 0, 
    persistent_op INTEGER NOT NULL DEFAULT 0,
    author_id INTEGER,
    board_id INTEGER NOT NULL DEFAULT 0,

    hid INTEGER NOT NULL DEFAULT 0
        CHECK (hid IN (0, 1)),

    locked INTEGER NOT NULL DEFAULT 0
        CHECK (locked IN (0, 1)),

    gems INTEGER NOT NULL DEFAULT 0,

    sticky INTEGER NOT NULL DEFAULT 0
        CHECK (sticky IN (0, 1)),

    bump_limit_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (bump_limit_enabled IN (0, 1)),

    unique_ips INTEGER NOT NULL DEFAULT 0,

    deleted_at INTEGER,
    deleted_by INTEGER

    -- FOREIGN KEY (author_id)
    --     REFERENCES users(id)
    --     ON DELETE SET NULL,

    -- FOREIGN KEY (board_id)
    --     REFERENCES moshpits(id)
    --     ON DELETE CASCADE,

    -- FOREIGN KEY (deleted_by)
    --     REFERENCES users(id)
    --     ON DELETE SET NULL
);

-- CREATE INDEX IF NOT EXISTS idx_threads_board
--     ON threads(board_id);

-- CREATE INDEX IF NOT EXISTS idx_threads_author
--     ON threads(author_id);

CREATE INDEX IF NOT EXISTS idx_threads_bumped_at
    ON threads(bumped_at);

CREATE INDEX IF NOT EXISTS idx_threads_created_at
    ON threads(created_at);

CREATE INDEX IF NOT EXISTS idx_threads_hid
    ON threads(hid);

CREATE INDEX IF NOT EXISTS idx_threads_deleted_at
    ON threads(deleted_at);


-- ============================================================
-- POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    author_id INTEGER,

    thread_id INTEGER NOT NULL,
    board_id INTEGER NOT NULL,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER,

    hidden INTEGER NOT NULL DEFAULT 0
        CHECK (hidden IN (0, 1)),

    deleted_at INTEGER,
    deleted_by INTEGER,

    ip_hash TEXT,
    user_agent_hash TEXT,

    country TEXT,
    country_name TEXT,
    flag TEXT,

    poster_id TEXT,

    gems INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (author_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (thread_id)
        REFERENCES threads(id)
        ON DELETE CASCADE,

    FOREIGN KEY (board_id)
        REFERENCES moshpits(id)
        ON DELETE CASCADE,

    FOREIGN KEY (deleted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_thread
    ON posts(thread_id);

CREATE INDEX IF NOT EXISTS idx_posts_board
    ON posts(board_id);

CREATE INDEX IF NOT EXISTS idx_posts_author
    ON posts(author_id);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
    ON posts(created_at);

CREATE INDEX IF NOT EXISTS idx_posts_ip_hash
    ON posts(ip_hash);

CREATE INDEX IF NOT EXISTS idx_posts_deleted_at
    ON posts(deleted_at);

CREATE INDEX IF NOT EXISTS idx_posts_poster_id
    ON posts(poster_id);


-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    reporter_id INTEGER,
    post_id INTEGER NOT NULL,

    time INTEGER NOT NULL DEFAULT (unixepoch()),

    rule_broken TEXT,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),

    resolved_at INTEGER,
    resolved_by INTEGER,

    reason TEXT,

    FOREIGN KEY (reporter_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (post_id)
        REFERENCES posts(id)
        ON DELETE CASCADE,

    FOREIGN KEY (resolved_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_post
    ON reports(post_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter
    ON reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_status
    ON reports(status);

CREATE INDEX IF NOT EXISTS idx_reports_time
    ON reports(time);


-- ============================================================
-- BANS
-- ============================================================

CREATE TABLE IF NOT EXISTS bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER,
    ip_hash TEXT,

    board_id INTEGER,
    post_id INTEGER,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER,

    reason TEXT,
    rule TEXT,

    banned_by INTEGER,

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (board_id)
        REFERENCES moshpits(id)
        ON DELETE CASCADE,

    FOREIGN KEY (post_id)
        REFERENCES posts(id)
        ON DELETE SET NULL,

    FOREIGN KEY (banned_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bans_user
    ON bans(user_id);

CREATE INDEX IF NOT EXISTS idx_bans_ip_hash
    ON bans(ip_hash);

CREATE INDEX IF NOT EXISTS idx_bans_board
    ON bans(board_id);

CREATE INDEX IF NOT EXISTS idx_bans_post
    ON bans(post_id);

CREATE INDEX IF NOT EXISTS idx_bans_active
    ON bans(active);

CREATE INDEX IF NOT EXISTS idx_bans_expires_at
    ON bans(expires_at);


-- ============================================================
-- APPEALS
-- ============================================================

CREATE TABLE IF NOT EXISTS appeals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,
    ban_id INTEGER NOT NULL,

    post_id INTEGER,
    ip_hash TEXT,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER,

    reason TEXT,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'reviewing', 'approved', 'denied')),

    reviewed_at INTEGER,
    reviewed_by INTEGER,

    decision TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (ban_id)
        REFERENCES bans(id)
        ON DELETE CASCADE,

    FOREIGN KEY (post_id)
        REFERENCES posts(id)
        ON DELETE SET NULL,

    FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_appeals_user
    ON appeals(user_id);

CREATE INDEX IF NOT EXISTS idx_appeals_ban
    ON appeals(ban_id);

CREATE INDEX IF NOT EXISTS idx_appeals_post
    ON appeals(post_id);

CREATE INDEX IF NOT EXISTS idx_appeals_status
    ON appeals(status);


-- ============================================================
-- MODERATION ACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS moderation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    moderator_id INTEGER NOT NULL,

    board_id INTEGER,

    action_type TEXT NOT NULL,

    post_id INTEGER,
    thread_id INTEGER,
    user_id INTEGER,
    ban_id INTEGER,
    report_id INTEGER,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    reason TEXT,

    metadata TEXT,

    FOREIGN KEY (moderator_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (board_id)
        REFERENCES moshpits(id)
        ON DELETE SET NULL,

    FOREIGN KEY (post_id)
        REFERENCES posts(id)
        ON DELETE SET NULL,

    FOREIGN KEY (thread_id)
        REFERENCES threads(id)
        ON DELETE SET NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (ban_id)
        REFERENCES bans(id)
        ON DELETE SET NULL,

    FOREIGN KEY (report_id)
        REFERENCES reports(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator
    ON moderation_actions(moderator_id);

CREATE INDEX IF NOT EXISTS idx_mod_actions_board
    ON moderation_actions(board_id);

CREATE INDEX IF NOT EXISTS idx_mod_actions_post
    ON moderation_actions(post_id);

CREATE INDEX IF NOT EXISTS idx_mod_actions_thread
    ON moderation_actions(thread_id);

CREATE INDEX IF NOT EXISTS idx_mod_actions_user
    ON moderation_actions(user_id);

CREATE INDEX IF NOT EXISTS idx_mod_actions_ban
    ON moderation_actions(ban_id);

CREATE INDEX IF NOT EXISTS idx_mod_actions_report
    ON moderation_actions(report_id);

CREATE INDEX IF NOT EXISTS idx_mod_actions_type
    ON moderation_actions(action_type);

CREATE INDEX IF NOT EXISTS idx_mod_actions_created
    ON moderation_actions(created_at);