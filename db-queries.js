const { db } = require('./db')
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
  original_comment,
  html
) {
  return db
    .prepare(
      `
        INSERT INTO posts (author_id, ip, thread_id, board_id, comment, post_number, country, updated_at, original_comment, html)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      original_comment,
      html
    )
}

function getPosts(thread_id) {
  return db.prepare(`
    SELECT * FROM posts WHERE thread_id = ? ORDER BY post_number ASC
    `).all(thread_id)
}

function getLastPost(thread_id) {
  return db.prepare(`
    SELECT * FROM posts WHERE thread_id = ? ORDER BY post_number DESC LIMIT 1
    `).get(thread_id)
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

function updatePostCount(thread_id) {
  db.prepare(`
      UPDATE threads SET post_count = post_count + 1 WHERE id = ?
    `).run(thread_id)
}
function createThread (a, b, c, d, e, board_id, original_comment, html) {
  return db
    .prepare(
      `
        INSERT INTO threads (author_id, 
        moshpit, comment, 
        updated_at, bumped_at, board_id, original_comment, html)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
    `
    )
    .get(a, b, c, d, e, board_id, original_comment, html)
}

function getThread (id) {
  return db
    .prepare(
      `
    SELECT * FROM threads WHERE id = ?
    `
    )
    .get(id)
}

function getThreads (moshpit) {
  return db
    .prepare(
      `
    SELECT * FROM threads WHERE moshpit = ? ORDER BY bumped_at DESC
    `
    )
    .all(moshpit)
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
          (
              SELECT COUNT(*)
              FROM posts p
              JOIN threads t2
                  ON t2.id = p.thread_id
              WHERE t2.moshpit = m.title
                AND p.created_at >= unixepoch() - 3600
          )
          +
          (
              SELECT COUNT(*)
              FROM threads t3
              WHERE t3.moshpit = m.title
                AND t3.created_at >= unixepoch() - 3600
          ) AS post_count
      FROM moshpits m
      WHERE EXISTS (
          SELECT 1
          FROM threads t4
          WHERE t4.moshpit = m.title
            AND t4.created_at >= unixepoch() - 3600
      )
      OR EXISTS (
          SELECT 1
          FROM posts p2
          JOIN threads t5
              ON t5.id = p2.thread_id
          WHERE t5.moshpit = m.title
            AND p2.created_at >= unixepoch() - 3600
      )
      ORDER BY post_count DESC
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
          COUNT(p.id) + COUNT(DISTINCT t.id) AS post_count
      FROM moshpits m
      JOIN threads t
          ON t.moshpit = m.title
      LEFT JOIN posts p
          ON p.thread_id = t.id
      GROUP BY m.id, m.title
      ORDER BY post_count DESC
      LIMIT 100;
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
          m.created_at
      FROM moshpits m
      ORDER BY m.created_at DESC
      LIMIT 100;
    `
    )
    .all()
}

function getOrCreateMoshpit (moshpit, user) {
  let mosh = db.prepare(`SELECT * FROM moshpits WHERE title = ?`).get(moshpit)

  if (mosh) {
    return mosh
  } else {
    const newmosh = db
      .prepare(
        `
      INSERT INTO moshpits (title, author_id) VALUES (?, ?)
      `
      )
      .run(moshpit, user)
    mosh = db.prepare(`SELECT * FROM moshpits WHERE title = ?`).get(moshpit)
    return mosh
  }
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
  updatePostCount
}
