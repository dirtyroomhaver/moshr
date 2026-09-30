const { db } = require('./db')
function getCachedResults () {
  const row = db
    .prepare(`
      SELECT trending, popular, recent, updated_at
      FROM cached_results
      WHERE cache_key = 'cache'
    `)
    .get()

  if (!row) return null

  return {
    trending: JSON.parse(row.trending),
    popular: JSON.parse(row.popular),
    recent: JSON.parse(row.recent),
    updated_at: row.updated_at
  }
}

function setCachedResults (trending, popular, recent) {
  db
    .prepare(`
      INSERT INTO cached_results (
        cache_key,
        trending,
        popular,
        recent,
        updated_at
      )
      VALUES ('cache', ?, ?, ?, unixepoch())

      ON CONFLICT(cache_key) DO UPDATE SET
        trending = excluded.trending,
        popular = excluded.popular,
        recent = excluded.recent,
        updated_at = excluded.updated_at
    `)
    .run(
      JSON.stringify(trending),
      JSON.stringify(popular),
      JSON.stringify(recent)
    )
}
// -------------------------
// POSTS
// -------------------------
function createPost (
  author_id,
  ip,
  thread_id,
  board_id,
  comment,
  post_number,
  country,
  updated_at,
  html
) {
  return db
    .prepare(
      `
        INSERT INTO posts (author_id, ip, thread_id, board_id, comment, post_number, country, updated_at, html)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
    `
    )
    .get(
      author_id,
      ip,
      thread_id,
      board_id,
      comment,
      post_number,
      country,
      updated_at,
      html
    )
}

function getPosts(thread_id) {
  return db.prepare(`
    SELECT id, thread_id, board_id, post_number, created_at, updated_at, comment, hid, html, shot, slapped, country FROM posts WHERE thread_id = ? ORDER BY post_number ASC
    `).all(thread_id)
}

function getLastPost(thread_id) {
  return db.prepare(`
    SELECT id, thread_id, board_id, post_number, created_at, updated_at, comment, hid, html, shot, slapped, country FROM posts WHERE thread_id = ? ORDER BY post_number DESC LIMIT 1
    `).get(thread_id)
}

function getNewPosts(thread_id, last_post) {
    return db.prepare(`
    SELECT id, thread_id, board_id, post_number, created_at, updated_at, comment, hid, html, shot, slapped, country FROM posts WHERE thread_id = ? AND post_number >= ? ORDER BY post_number ASC
    `).all(thread_id, last_post)
}
// -------------------------
// USER
// -------------------------
function getUser (cookie) {
  return db
    .prepare(
      `
        SELECT *
        FROM users
        WHERE session_id = ?
    `
    )
    .get(cookie)
}


function createUser (session_id, ip, country) {
  return db
    .prepare(
      `
        INSERT INTO users (session_id, ip, country)
        VALUES (?, ?, ?)
        RETURNING *
    `
    )
    .get(session_id, ip, country)
}

function createAdmin (session_id, code, pin_hash) {
  return db
    .prepare(
      `
        INSERT INTO users (session_id, code, pin_hash)
        VALUES (?, ?, ?)
        RETURNING *
    `
    )
    .get(session_id, code, pin_hash)
}
function banUser (text) {
  return db
    .prepare(
      `
        INSERT INTO threads (thread_text)
        VALUES (?)
        RETURNING *
    `
    )
    .get(text)
}
// -------------------------
// THREADS
// -------------------------

function updatePostCount(thread_id, moshpit) {
  db.prepare(`
      UPDATE threads SET post_count = post_count + 1 WHERE id = ?
    `).run(thread_id)
  db.prepare(`UPDATE moshpits SET post_count = post_count + 1 WHERE title = ?
    `).run(moshpit)
}
function createThread (a, b, c, d, e, board_id, html, ip, country) {
  db.prepare(`UPDATE moshpits SET thread_count = thread_count + 1 WHERE title = ?`).run(b)
  return db
    .prepare(
      `
        INSERT INTO threads (author_id, 
        moshpit, comment, 
        updated_at, bumped_at, board_id, html, ip, country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
    `
    )
    .get(a, b, c, d, e, board_id, html, ip, country)
}
function bumpThread (bumped_at,thread_id) {

  return db.prepare(`
      UPDATE threads SET bumped_at = ? WHERE id = ?
    `).run(bumped_at, thread_id)
}
function updateThread (updated_at,thread_id) {

  return db.prepare(`
      UPDATE threads SET updated_at = ? WHERE id = ?
    `).run(updated_at, thread_id)
}
function getThread (id) {
  return db
    .prepare(
      `
    SELECT id, post_count, comment, created_at, updated_at, bumped_at, board_id, moshpit, html, country, hid, locked, sticky FROM threads WHERE id = ?
    `
    )
    .get(id)
}

function getThreads (moshpit) {
  return db
    .prepare(
      `
    SELECT id, post_count, comment, created_at, updated_at, bumped_at, board_id, moshpit, html, country, hid, locked, sticky FROM threads WHERE moshpit = ? ORDER BY bumped_at DESC LIMIT 150
    `
    )
    .all(moshpit)
}
function deleteOldThreads () {
  return db
    .prepare(`
      DELETE FROM threads
      WHERE created_at < unixepoch() - (60*60*24*7)
    `)
    .run()
}
// -------------------------
// MOSHPITS
// -------------------------
function getTrendingMoshpits () {
  return db
    .prepare(
      `
SELECT
    m.id,
    m.title,
    m.post_count,
    m.thread_count,

    (
        SELECT COUNT(*)
        FROM threads t
        WHERE t.moshpit = m.title
          AND t.created_at >= unixepoch() - 3600
    )
    +
    (
        SELECT COUNT(*)
        FROM posts p
        JOIN threads t2 ON t2.id = p.thread_id
        WHERE t2.moshpit = m.title
          AND p.created_at >= unixepoch() - 3600
    ) AS recent_count

FROM moshpits m

WHERE EXISTS (
    SELECT 1
    FROM threads t
    WHERE t.moshpit = m.title
      AND t.created_at >= unixepoch() - 3600
)
OR EXISTS (
    SELECT 1
    FROM posts p
    JOIN threads t2 ON t2.id = p.thread_id
    WHERE t2.moshpit = m.title
      AND p.created_at >= unixepoch() - 3600
)

ORDER BY recent_count DESC
LIMIT 100;
    `
    )
    .all()
}

function getPopularMoshpits () {
  return db
    .prepare(
      `
SELECT 
    m.id, 
    m.title,
    m.thread_count,
    m.post_count
FROM moshpits m
ORDER BY (m.post_count + m.thread_count) DESC
LIMIT 1000;
    `
    )
    .all()
}

function getRecentMoshpits () {
  return db
    .prepare(
      `
SELECT
          m.id,
          m.title,
          m.created_at,
          m.post_count,
          m.thread_count
      FROM moshpits m
      ORDER BY m.created_at DESC
      LIMIT 100;
    `
    )
    .all()
}

function getOrCreateMoshpit (title) {
  db.prepare(
    `INSERT INTO moshpits (title) VALUES (?) ON CONFLICT(title) DO NOTHING`
  ).run(title)

  return db
    .prepare(`SELECT id, title, created_at, flags FROM moshpits WHERE title = ?`)
    .get(title)
}
function getSettings() {
  return db.prepare(`SELECT * FROM site_settings WHERE id = ?`).get(1)
}
function refreshCache () {
  const trending = getTrendingMoshpits()
  const popular = getPopularMoshpits()
  const recent = getRecentMoshpits()

  setCachedResults(
    trending,
    popular,
    recent
  )
}

function deleteLowThreads() {
  db.prepare(`
    DELETE FROM threads
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY board_id
                ORDER BY
                    CASE WHEN bumped_at IS NULL THEN 1 ELSE 0 END,
                    bumped_at DESC,
                    id DESC
            ) AS position
        FROM threads
        WHERE sticky = 0
    )
    WHERE position > ?
);`).run(getSettings.max_threads)
}
module.exports = {
  getUser,
  createUser,
  banUser,
  createThread,
  getThread,
  getThreads,
  getPopularMoshpits,
  getTrendingMoshpits,
  getRecentMoshpits,
  getOrCreateMoshpit,
  createPost,
  getPosts,
  getLastPost,
  updatePostCount,
  bumpThread,
  updateThread,
  getNewPosts,
  getSettings,
  setCachedResults,
  getCachedResults,
  refreshCache,
  deleteOldThreads,
  deleteLowThreads
}
