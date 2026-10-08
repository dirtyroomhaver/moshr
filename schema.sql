PRAGMA foreign_keys = ON;

-- ============================================================
-- SITE SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_results (
    cache_key TEXT PRIMARY KEY,
    trending TEXT NOT NULL,
    popular TEXT NOT NULL,
    recent TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS slaps (
    victim_id INTEGER,
    ip TEXT,
    thread_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (victim_id)
        REFERENCES users(id)
        ON DELETE SET NULL,
    FOREIGN KEY (thread_id)
        REFERENCES threads(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shots (
    victim_id INTEGER,
    ip TEXT,
    thread_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (victim_id)
        REFERENCES users(id)
        ON DELETE SET NULL,
    FOREIGN KEY (thread_id)
        REFERENCES threads(id)
        ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    thread_id INTEGER,
    notification_type TEXT,
    comment TEXT,
    seen INTEGER NOT NULL DEFAULT 0,
FOREIGN KEY (thread_id)
        REFERENCES threads(id)
        ON DELETE CASCADE,
            FOREIGN KEY (receiver_id)
        REFERENCES users(id)
        ON DELETE SET NULL,
    FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    thread_id INTEGER,
    post_id INTEGER,
FOREIGN KEY (thread_id)
        REFERENCES threads(id)
        ON DELETE CASCADE,
        FOREIGN KEY (post_id)
        REFERENCES posts(id)
        ON DELETE CASCADE,
            FOREIGN KEY (receiver_id)
        REFERENCES users(id)
        ON DELETE SET NULL,
    FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    max_threads INTEGER NOT NULL DEFAULT 150,
    max_posts INTEGER NOT NULL DEFAULT 500,

    frozen INTEGER NOT NULL DEFAULT 0 CHECK (frozen IN (0, 1)),
    silenced INTEGER NOT NULL DEFAULT 0 CHECK (silenced IN (0, 1)),

    slowmode INTEGER NOT NULL DEFAULT 0 CHECK (slowmode IN (0, 1)),
    slowmode_multiplier REAL NOT NULL DEFAULT 1.0,
    thread_limit INTEGER NOT NULL DEFAULT 5,
    new_poster_timer_thread INTEGER NOT NULL DEFAULT 0,
    new_poster_timer_posts INTEGER NOT NULL DEFAULT 0,

    post_cooldown_thread INTEGER NOT NULL DEFAULT 180,
    post_cooldown_post INTEGER NOT NULL DEFAULT 5,
    bump_limit INTEGER NOT NULL DEFAULT 300,
    decay_timer INTEGER NOT NULL DEFAULT 604800,
    report_cooldown INTEGER NOT NULL DEFAULT 10,
    announcement TEXT NOT NULL DEFAULT 'WELCOME TO MOSHR.NET',
    announcement_status INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO site_settings (id)
VALUES (1);


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    ip TEXT,

    session_id TEXT NOT NULL UNIQUE,

    country TEXT,

    is_owner INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_mod INTEGER NOT NULL DEFAULT 0,
    is_janitor INTEGER NOT NULL DEFAULT 0,
    is_vip INTEGER NOT NULL DEFAULT 0,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    banned INTEGER NOT NULL DEFAULT 0,
    ban_count INTEGER DEFAULT 0,
    posts INTEGER NOT NULL DEFAULT 0,
    code TEXT,
    pin_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_ip
    ON users(ip);

CREATE INDEX IF NOT EXISTS idx_users_session_id
    ON users(session_id);



-- ============================================================
-- MOSHPITS / BOARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS moshpits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    title TEXT NOT NULL UNIQUE CHECK(length(title) <= 7),
    rules TEXT,
    bio TEXT,

    is_disabled INTEGER NOT NULL DEFAULT 0
        CHECK (is_disabled IN (0, 1)),

    hid INTEGER NOT NULL DEFAULT 0
        CHECK (hid IN (0, 1)),

    max_threads INTEGER,
    max_posts INTEGER,

    frozen INTEGER NOT NULL DEFAULT 0
        CHECK (frozen IN (0, 1)),

    silenced INTEGER NOT NULL DEFAULT 0
        CHECK (silenced IN (0, 1)),

    slowmode INTEGER NOT NULL DEFAULT 0
        CHECK (slowmode IN (0, 1)),

    author_id INTEGER,

    new_poster_timer_thread INTEGER,
    new_poster_timer_posts INTEGER,

    post_cooldown_thread INTEGER,
    post_cooldown_post INTEGER,

   post_count INTEGER NOT NULL DEFAULT 0,
    thread_count INTEGER NOT NULL DEFAULT 0,

    bump_limit INTEGER,

    flags INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (author_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS idx_moshpits_title
    ON moshpits(title);

CREATE INDEX IF NOT EXISTS idx_moshpits_author
    ON moshpits(author_id);

CREATE INDEX IF NOT EXISTS idx_moshpits_hid
    ON moshpits(hid);

CREATE INDEX IF NOT EXISTS idx_moshpits_dis
    ON moshpits(is_disabled);
-- ============================================================
-- -shot
-- ============================================================


-- ============================================================
-- THREADS
-- ============================================================

CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    post_count INTEGER NOT NULL DEFAULT 0,
    comment TEXT NOT NULL,
    
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER,
    bumped_at INTEGER,
    author_id INTEGER,
    board_id INTEGER NOT NULL,
    moshpit TEXT NOT NULL,
    html TEXT NOT NULL, 
    country TEXT,
    ip TEXT,
    hid INTEGER NOT NULL DEFAULT 0
        CHECK (hid IN (0, 1)),

    locked INTEGER NOT NULL DEFAULT 0
        CHECK (locked IN (0, 1)),

    gems INTEGER NOT NULL DEFAULT 0,

    sticky INTEGER NOT NULL DEFAULT 0
        CHECK (sticky IN (0, 1)),

    bump_limit_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (bump_limit_enabled IN (0, 1)),

    unique_ips INTEGER NOT NULL DEFAULT 1,

    deleted_at INTEGER,
    deleted_by INTEGER,
    sig TEXT,
    FOREIGN KEY (author_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (board_id)
        REFERENCES moshpits(id)
        ON DELETE CASCADE,

    FOREIGN KEY (deleted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_threads_moshpit
    ON threads(moshpit);

CREATE INDEX IF NOT EXISTS idx_threads_author
ON threads(author_id);


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
    ip TEXT,
    thread_id INTEGER NOT NULL,
    board_id INTEGER NOT NULL,
    post_number INTEGER NOT NULL, 
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER,
    comment TEXT NOT NULL,
    
    hid INTEGER NOT NULL DEFAULT 0 CHECK (hid IN (0, 1)),
       html TEXT NOT NULL, 
    deleted_at INTEGER,
    deleted_by INTEGER,

    shot INTEGER NOT NULL DEFAULT 0, 
    slapped INTEGER NOT NULL DEFAULT 0, 
    country TEXT,
    sig TEXT, 
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

CREATE INDEX IF NOT EXISTS idx_posts_author_board_created
ON posts(author_id, board_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
    ON posts(created_at);


CREATE INDEX IF NOT EXISTS idx_posts_deleted_at
    ON posts(deleted_at);




-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    reporter_id INTEGER,
    post_id INTEGER,
    thread_id INTEGER,
    violator_id INTEGER NOT NULL,
    report_time INTEGER NOT NULL DEFAULT (unixepoch()),
    html TEXT,
    rule_broken TEXT,
    victim_ip TEXT,
    report_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (report_status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    ban_count INTEGER,
    resolved_at INTEGER,
    resolved_by INTEGER,
    reason TEXT,

    FOREIGN KEY (reporter_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

FOREIGN KEY (violator_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
    FOREIGN KEY (resolved_by)
        REFERENCES users(id)
        ON DELETE SET NULL,
        FOREIGN KEY (thread_id)
    REFERENCES threads(id)
    ON DELETE CASCADE,

FOREIGN KEY (post_id)
    REFERENCES posts(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reports_post
    ON reports(post_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter
    ON reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_report_status
    ON reports(report_status);

CREATE INDEX IF NOT EXISTS idx_reports_report_time
    ON reports(report_time);


-- ============================================================
-- BANS
-- ============================================================

CREATE TABLE IF NOT EXISTS bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER,
    ip TEXT,
    session_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_bans_ip
    ON bans(ip);

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
    ip TEXT,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER,
    ban_count INTEGER,
    reason TEXT,

    appeal_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (appeal_status IN ('pending', 'reviewing', 'approved', 'denied')),

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

CREATE INDEX IF NOT EXISTS idx_appeals_appeal_status
    ON appeals(appeal_status);


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
CREATE INDEX IF NOT EXISTS idx_posts_board_created
ON posts(board_id, created_at);
CREATE INDEX IF NOT EXISTS idx_threads_board_bumped
ON threads(board_id, bumped_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_board_created
ON threads(board_id, created_at);
CREATE TRIGGER IF NOT EXISTS trg_posts_after_delete
AFTER DELETE ON posts
BEGIN
    UPDATE threads
    SET post_count = MAX(post_count - 1, 0)
    WHERE id = OLD.thread_id;

    UPDATE moshpits
    SET post_count = MAX(post_count - 1, 0)
    WHERE id = OLD.board_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_threads_after_delete
AFTER DELETE ON threads
BEGIN
    UPDATE moshpits
    SET thread_count = MAX(thread_count - 1, 0)
    WHERE id = OLD.board_id;
END;
