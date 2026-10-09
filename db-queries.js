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
  html,
  sig,
  owner
) {
  return db
    .prepare(
      `
        INSERT INTO posts (author_id, ip, thread_id, board_id, comment, post_number, country, updated_at, html, sig, is_owner)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      html,
      sig,
      owner
    )
}

function getPosts(thread_id) {
  return db.prepare(`
    SELECT is_owner, author_id, sig, id, thread_id, board_id, post_number, created_at, updated_at, comment, hid, html, shot, slapped, country FROM posts WHERE thread_id = ? ORDER BY post_number ASC
    `).all(thread_id)
}
function getPostAdmin(post_id) {
  return db.prepare(`
    SELECT * FROM posts WHERE id = ?
    `).get(post_id)
}

function getLastPost(thread_id) {
  return db.prepare(`
    SELECT is_owner, author_id, sig, id, thread_id, board_id, post_number, created_at, updated_at, comment, hid, html, shot, slapped, country FROM posts WHERE thread_id = ? ORDER BY post_number DESC LIMIT 1
    `).get(thread_id)
}

function getNewPosts(thread_id, last_post) {
    return db.prepare(`
    SELECT author_id, sig, id, thread_id, board_id, post_number, created_at, updated_at, comment, hid, html, shot, slapped, country FROM posts WHERE thread_id = ? AND post_number >= ? ORDER BY post_number ASC
    `).all(thread_id, last_post)
}
// -------------------------
// USER
// -------------------------
function getUser (cookie) {
  return db
    .prepare(
      `
        SELECT id, country, is_owner, is_admin, is_mod, is_janitor, is_vip
        FROM users
        WHERE session_id = ?
    `
    )
    .get(cookie)
}

function getUserAdmin (user_id) {
  return db
    .prepare(
      `
        SELECT *
        FROM users
        WHERE id = ?
    `
    )
    .get(user_id)
}

function getUserAdminCookie (session) {
  return db
    .prepare(
      `
        SELECT *
        FROM users
        WHERE session_id = ?
    `
    )
    .get(session)
}


function createUser (session_id, ip) {
  return db
    .prepare(
      `
        INSERT INTO users (session_id, ip)
        VALUES (?, ?)
        RETURNING *
    `
    )
    .get(session_id, ip)
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
function banUser (user, reason, rule) {
  db.prepare(`UPDATE or IGNORE users SET banned = 1 WHERE id = ? AND banned = 0;`).run(user.id)
  return db
    .prepare(
      `
        INSERT INTO bans (user_id, ip, session_id, reason, rule)
        VALUES (?, ?, ?, ?, ?)
    `
    )
    .run(user.id, user.ip, user.cookie, reason, rule)
}
// -------------------------
// THREADS
// -------------------------

function updatePostCount(thread_id, moshpit) {

  const now = Math.floor(Date.now() / 1000)

  const transaction = db.transaction(() => {

    const result = db.prepare(`

      UPDATE threads

      SET
        post_count = post_count + 1,
        updated_at = ?

      WHERE id = ?

    `).run(now, thread_id)

    if (result.changes === 0) {

      throw new Error('Thread not found while updating post count.')

    }

    db.prepare(`

      UPDATE moshpits

      SET post_count = post_count + 1

      WHERE title = ?

    `).run(moshpit)

  })

  transaction()

}
function createThread (a, b, c, d, e, board_id, html, ip, country, sig, owner) {
  db.prepare(`UPDATE moshpits SET thread_count = thread_count + 1 WHERE title = ?`).run(b)
  return db
    .prepare(
      `
        INSERT INTO threads (author_id, 
        moshpit, comment, 
        updated_at, bumped_at, board_id, html, ip, country, sig, is_owner)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
    `
    )
    .get(a, b, c, d, e, board_id, html, ip, country, sig, owner)
}
function bumpThread (bumped_at, thread_id) {

  const thread = db.prepare(`

    SELECT

      id,
      post_count,
      hid,
      bump_limit_enabled

    FROM threads

    WHERE id = ?

    LIMIT 1

  `).get(thread_id)



  if (!thread || thread.hid) {

    return { bumped: false, reason: 'hidden' }

  }



  if (!thread.bump_limit_enabled) {

    return { bumped: false, reason: 'bump_limit_disabled' }

  }



  const siteSettings = db.prepare(`

    SELECT bump_limit

    FROM site_settings

    WHERE id = 1

    LIMIT 1

  `).get()



  const bumpLimit = siteSettings?.bump_limit ?? 0



  // Use the posts table here so the bump decision is correct even if the
  // caller invokes bumpThread before updatePostCount.
  const postCount = db.prepare(`

    SELECT COUNT(*) AS count

    FROM posts

    WHERE thread_id = ?

  `).get(thread_id)?.count ?? thread.post_count



  // bump_limit is the maximum post count at which a thread may still bump.
  // Example: limit 300 => post 300 can bump; post 301 cannot.
  if (bumpLimit > 0 && postCount > bumpLimit) {

    return { bumped: false, reason: 'bump_limit_reached' }

  }



  // This is called after the new post exists. Compare the newest two posts
  // so consecutive posts by the same user do not bump the thread.
  const lastTwoPosts = db.prepare(`

    SELECT author_id

    FROM posts

    WHERE thread_id = ?

    ORDER BY post_number DESC

    LIMIT 2

  `).all(thread_id)



  if (
    lastTwoPosts.length >= 2 &&
    lastTwoPosts[0].author_id === lastTwoPosts[1].author_id
  ) {

    return { bumped: false, reason: 'same_poster' }

  }



  const result = db.prepare(`

    UPDATE threads

    SET bumped_at = ?

    WHERE id = ?

  `).run(bumped_at, thread_id)



  return {

    bumped: result.changes > 0,

    reason: result.changes > 0 ? 'bumped' : 'thread_not_found'

  }

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
    SELECT is_owner, author_id, id, post_count, comment, created_at, updated_at, bumped_at, board_id, moshpit, html, sig, country, hid, locked, sticky FROM threads WHERE id = ?
    `
    )
    .get(id)
}
function getThreadAdmin (id) {
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
    SELECT id, post_count, comment, created_at, updated_at, bumped_at, board_id, moshpit, html, country, hid, locked, sticky FROM threads WHERE moshpit = ? ORDER BY bumped_at DESC LIMIT 150
    `
    )
    .all(moshpit)
}
function getThreadsThread (moshpit) {
  return db
    .prepare(
      `
    SELECT author_id, id, post_count, comment, created_at, updated_at, bumped_at, board_id, moshpit, html, country, hid, locked, sticky FROM threads WHERE moshpit = ? ORDER BY bumped_at DESC LIMIT 150
    `
    )
    .all(moshpit)
}
function deleteOldThreads () {
  return db
    .prepare(`
      DELETE FROM threads
      WHERE created_at < unixepoch() - (2419200) AND sticky = 0
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
    m.hid,

    (
        SELECT COUNT(*)
        FROM threads t
        WHERE t.moshpit = m.title
          AND t.created_at >= unixepoch() - 14400
    )
    +
    (
        SELECT COUNT(*)
        FROM posts p
        JOIN threads t2 ON t2.id = p.thread_id
        WHERE t2.moshpit = m.title
          AND p.created_at >= unixepoch() - 14400
    ) AS recent_count

FROM moshpits m

WHERE EXISTS (
    SELECT 1
    FROM threads t
    WHERE t.moshpit = m.title
      AND t.created_at >= unixepoch() - 14400
)
OR EXISTS (
    SELECT 1
    FROM posts p
    JOIN threads t2 ON t2.id = p.thread_id
    WHERE t2.moshpit = m.title
      AND p.created_at >= unixepoch() - 14400
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
    m.post_count,
    m.hid
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
          m.thread_count,
          m.hid
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
    .prepare(`SELECT id, title, created_at, flags, hid FROM moshpits WHERE title = ?`)
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
  const settings = getSettings()

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
    )
  `).run(settings.max_threads)
}

const checkPost_Creation = db.prepare(`
  SELECT
    -- USER
    u.id AS user_id,
    u.created_at AS user_created_at,

    -- SITE SETTINGS
    s.frozen AS site_frozen,
    s.silenced AS site_silenced,
    s.slowmode AS site_slowmode,
    s.slowmode_multiplier,

    s.thread_limit,

    s.new_poster_timer_thread AS site_new_poster_timer_thread,
    s.new_poster_timer_posts AS site_new_poster_timer_posts,

    s.post_cooldown_thread AS site_post_cooldown_thread,
    s.post_cooldown_post AS site_post_cooldown_post,

    -- MOSHPIT
    m.id AS moshpit_id,
    m.title AS moshpit_title,
    m.frozen AS moshpit_frozen,
    m.silenced AS moshpit_silenced,
    m.slowmode AS moshpit_slowmode,

    m.new_poster_timer_thread AS moshpit_new_poster_timer_thread,
    m.new_poster_timer_posts AS moshpit_new_poster_timer_posts,

    m.post_cooldown_thread AS moshpit_post_cooldown_thread,
    m.post_cooldown_post AS moshpit_post_cooldown_post,

    -- USER THREAD COUNT IN THIS MOSHPIT
    (
      SELECT COUNT(*)
      FROM threads t
      WHERE t.author_id = u.id
        AND t.board_id = m.id
    ) AS user_thread_count,

    -- MOST RECENT THREAD BY THIS USER IN THIS MOSHPIT
    (
      SELECT t.created_at
      FROM threads t
      WHERE t.author_id = u.id
        AND t.board_id = m.id
      ORDER BY t.created_at DESC
      LIMIT 1
    ) AS last_thread_created_at,

    -- MOST RECENT POST BY THIS USER IN THIS MOSHPIT
    (
      SELECT p.created_at
      FROM posts p
      WHERE p.author_id = u.id
        AND p.board_id = m.id
      ORDER BY p.created_at DESC
      LIMIT 1
    ) AS last_post_created_at

  FROM users u
  CROSS JOIN site_settings s
  JOIN moshpits m
    ON m.title = ?
  WHERE u.id = ?
    AND s.id = 1
  LIMIT 1
`)



function checkPostCreation(user, moshpit, postType, threadId = null) {

  if (postType !== 'thread' && postType !== 'post') {

    throw new Error(`Invalid post type: ${postType}`)

  }



  const userId =

    typeof user === 'object'

      ? user.id

      : user



  const moshpitTitle =

    typeof moshpit === 'object'

      ? moshpit.title

      : moshpit



  const row = checkPost_Creation.get(moshpitTitle, userId)



  if (!row) {

    return {

      allowed: false,

      error: 'Unable to verify posting permissions.'

    }

  }


  // --------------------------------------------------
  // 0. USER BAN / BLOCK CHECK
  // --------------------------------------------------
  //
  // Site-wide ban.
  //
  // A ban can match:
  //   - user_id
  //   - session_id
  //   - IP address
  //
  // Owner, admin, and mod users bypass bans.
  //
  // board_id is intentionally ignored.
  // --------------------------------------------------

  const account = db.prepare(`
    SELECT
      id,
      ip,
      session_id,
      is_owner,
      is_admin,
      is_mod
    FROM users
    WHERE id = ?
    LIMIT 1
  `).get(userId)

  if (!account) {
    return {
      allowed: false,
      error: 'Unable to verify user account.'
    }
  }

  const privileged =
    account.is_owner === 1 ||
    account.is_admin === 1 ||
    account.is_mod === 1

  if (!privileged) {

    const now = Math.floor(Date.now() / 1000)

    const ban = db.prepare(`
      SELECT
        id,
        reason,
        rule,
        expires_at
      FROM bans
      WHERE active = 1
        AND (
          user_id = ?
          OR (
            session_id IS NOT NULL
            AND session_id = ?
          )
          OR (
            ip IS NOT NULL
            AND ip = ?
          )
        )
        AND (
          expires_at IS NULL
          OR expires_at > ?
        )
      ORDER BY created_at DESC
      LIMIT 1
    `).get(
      userId,
      account.session_id,
      account.ip,
      now
    )

    if (ban) {
      return {
        allowed: false,
        error: 'You are banned and may not create posts or threads.',
        banId: ban.id,
        retryAfter:
          ban.expires_at != null
            ? Math.max(0, ban.expires_at - now)
            : undefined
      }
    }
  }
  // --------------------------------------------------

  // 1. SITE FROZEN

  // --------------------------------------------------



  if (row.site_frozen) {

    return {

      allowed: false,

      error: 'Site frozen: no new posts or threads allowed.'

    }

  }



  // --------------------------------------------------

  // 2. MOSHPIT FROZEN

  // --------------------------------------------------



  if (row.moshpit_frozen) {

    return {

      allowed: false,

      error: 'Moshpit frozen: no new posts or threads allowed.'

    }

  }



  // --------------------------------------------------

  // 3. SITE SILENCED

  // --------------------------------------------------



  if (row.site_silenced) {

    return {

      allowed: false,

      error: `Site silenced: you may not create new ${postType}s.`

    }

  }



  // --------------------------------------------------

  // 4. MOSHPIT SILENCED

  // --------------------------------------------------



  if (row.moshpit_silenced) {

    return {

      allowed: false,

      error: `Moshpit silenced: you may not create new ${postType}s.`

    }

  }



  // --------------------------------------------------

  // 5. THREAD POSTING RESTRICTIONS

  // --------------------------------------------------

  // These checks only apply when posting inside an

  // existing thread.

  // --------------------------------------------------



  if (postType === 'post' && threadId != null) {

    const thread = db.prepare(`

      SELECT

        id,

        post_count,

        hid,

        bump_limit_enabled

      FROM threads

      WHERE id = ?

      LIMIT 1

    `).get(threadId)



    if (!thread) {

      return {

        allowed: false,

        error: 'Thread not found.'

      }

    }



    // Hidden threads cannot receive new posts.

    if (thread.hid) {

      return {

        allowed: false,

        error: 'This thread is hidden and cannot receive new posts.'

      }

    }



    // Moshpit max_posts overrides the global max_posts

    // when it has a value.

    const maxPosts =

      row.moshpit_max_posts ??

      row.site_max_posts



    // Do not allow another post once the thread has

    // reached its configured maximum.

    if (maxPosts > 0 && thread.post_count >= maxPosts) {

      return {

        allowed: false,

        error: 'This thread has reached the maximum number of posts.'

      }

    }

  }



  // --------------------------------------------------

  // 6. THREAD LIMIT

  // --------------------------------------------------



  if (

    postType === 'thread' &&

    row.thread_limit > 0 &&

    row.user_thread_count >= row.thread_limit

  ) {

    return {

      allowed: false,

      error: 'You have reached the max number of threads in this moshpit.'

    }

  }



  // --------------------------------------------------

  // 7. NEW POSTER TIMER

  // --------------------------------------------------



  const newPosterTimer =

    postType === 'thread'

      ? (

          row.moshpit_new_poster_timer_thread ??

          row.site_new_poster_timer_thread

        )

      : (

          row.moshpit_new_poster_timer_posts ??

          row.site_new_poster_timer_posts

        )



  if (

    newPosterTimer > 0 &&

    row.user_created_at > Math.floor(Date.now() / 1000) - newPosterTimer

  ) {

    return {

      allowed: false,

      error:

        postType === 'thread'

          ? 'Your account is too new to create a thread.'

          : 'Your account is too new to create a post.'

    }

  }



  // --------------------------------------------------

  // 8. SLAPS / SHOTS

  // --------------------------------------------------

  //

  // These checks only apply when posting INSIDE an

  // existing thread.

  //

  // threadId is null when creating a new thread, so

  // thread-specific slap/shot checks are skipped.

  //

  // SHOT:

  //   Permanently prevents the user from posting in

  //   this thread.

  //

  // SLAP:

  //   Prevents posting for 1 hour after the most recent

  //   slap in this thread.

  // --------------------------------------------------



  if (postType === 'post' && threadId != null) {

    const now = Math.floor(Date.now() / 1000)



    // ----------------------------------------------

    // Shot = permanent thread posting restriction

    // ----------------------------------------------



    const shot = db.prepare(`

      SELECT created_at

      FROM shots

      WHERE victim_id = ?

        AND thread_id = ?

      ORDER BY created_at DESC

      LIMIT 1

    `).get(userId, threadId)



    if (shot) {

      return {

        allowed: false,

        error: 'You have been shot and may not post in this thread.'

      }

    }



    // ----------------------------------------------

    // Slap = 1 hour thread posting restriction

    // ----------------------------------------------



    const slap = db.prepare(`

      SELECT created_at

      FROM slaps

      WHERE victim_id = ?

        AND thread_id = ?

      ORDER BY created_at DESC

      LIMIT 1

    `).get(userId, threadId)



    if (slap) {

      const slapCooldown = 60 * 60

      const elapsed = now - slap.created_at



      if (elapsed < slapCooldown) {

        const remaining = slapCooldown - elapsed



        return {

          allowed: false,

          error: `You have been slapped! You must wait ${remaining} more seconds before posting in this thread.`,

          retryAfter: remaining

        }

      }

    }

  }



  // --------------------------------------------------

  // 9. POST COOLDOWN

  // --------------------------------------------------

  //

  // Moshpit value wins if it is NOT NULL.

  //

  // Slowmode:

  //   site slowmode OR moshpit slowmode

  //

  // Multiplier ALWAYS comes from site_settings.

  //

  // moshpit.slowmode_timer is intentionally ignored.

  // --------------------------------------------------



  let cooldown =

    postType === 'thread'

      ? (

          row.moshpit_post_cooldown_thread ??

          row.site_post_cooldown_thread

        )

      : (

          row.moshpit_post_cooldown_post ??

          row.site_post_cooldown_post

        )



  const slowmodeEnabled =

    row.site_slowmode === 1 ||

    row.moshpit_slowmode === 1



  if (slowmodeEnabled) {

    cooldown *= row.slowmode_multiplier

  }



  const lastCreatedAt =

    postType === 'thread'

      ? row.last_thread_created_at

      : row.last_post_created_at



  if (

    cooldown > 0 &&

    lastCreatedAt != null &&

    lastCreatedAt > Math.floor(Date.now() / 1000) - cooldown

  ) {

    const elapsed = Math.floor(Date.now() / 1000) - lastCreatedAt

    const remaining = Math.max(0, cooldown - elapsed)



    return {

      allowed: false,

      error:

        postType === 'thread'

          ? `You must wait ${remaining} more seconds before creating another thread.`

          : `You must wait ${remaining} more seconds before creating another post.`,

      retryAfter: remaining

    }

  }



  // --------------------------------------------------

  // EVERYTHING PASSED

  // --------------------------------------------------



  return {

    allowed: true

  }

}

function moderationAction(
  victim,
  perpetrator,
  post = null,
  thread = null,
  actionType,
  length = 0,
  reason = ''
) {
  const validActions = [
    'slap',
    'shoot',
    'hide',
    'delete',
    'ban'
  ]

  // --------------------------------------------------
  // VALIDATION
  // --------------------------------------------------

  if (!validActions.includes(actionType)) {
    return {
      success: false,
      error: `Invalid moderation action: ${actionType}`
    }
  }

  if (!victim || victim.id == null) {
    return {
      success: false,
      error: 'A valid victim user is required.'
    }
  }

  if (!perpetrator || perpetrator.id == null) {
    return {
      success: false,
      error: 'A valid perpetrator user is required.'
    }
  }

  if (post == null && thread == null) {
    return {
      success: false,
      error: 'A post or thread is required for this moderation action.'
    }
  }

  if (post != null && thread != null) {
    return {
      success: false,
      error: 'Only one of post or thread may be supplied.'
    }
  }

  if (length < 0) {
    return {
      success: false,
      error: 'Action length cannot be negative.'
    }
  }

  const victimId = victim.id
  const perpetratorId = perpetrator.id

  const postId = post?.id ?? null
  const threadId = thread?.id ?? post?.thread_id ?? null

  const boardId =
    post?.board_id ??
    thread?.board_id ??
    null

  const victimIp =
    victim.ip ??
    post?.ip ??
    thread?.ip ??
    null

  const now = Math.floor(Date.now() / 1000)

  try {
    const transaction = db.transaction(() => {

      // ==================================================
      // 1. SLAP
      // ==================================================

      if (actionType === 'slap') {
        if (!post) {
          throw new Error('A post is required for a slap.')
        }

        if (!threadId) {
          throw new Error('Unable to determine thread for slap.')
        }

        db.prepare(`
          INSERT INTO slaps (
            victim_id,
            ip,
            thread_id
          )
          VALUES (?, ?, ?)
        `).run(
          victimId,
          victimIp,
          threadId
        )

        db.prepare(`
          UPDATE posts
          SET slapped = 1
          WHERE id = ?
        `).run(postId)

        db.prepare(`
          INSERT INTO moderation_actions (
            moderator_id,
            board_id,
            action_type,
            post_id,
            thread_id,
            user_id,
            reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          perpetratorId,
          boardId,
          'slap',
          postId,
          threadId,
          victimId,
          reason
        )
      }

      // ==================================================
      // 2. SHOOT
      // ==================================================

      else if (actionType === 'shoot') {
        if (!post) {
          throw new Error('A post is required for a shoot.')
        }

        if (!threadId) {
          throw new Error('Unable to determine thread for shoot.')
        }

        db.prepare(`
          INSERT INTO shots (
            victim_id,
            ip,
            thread_id
          )
          VALUES (?, ?, ?)
        `).run(
          victimId,
          victimIp,
          threadId
        )

        db.prepare(`
          UPDATE posts
          SET shot = 1
          WHERE id = ?
        `).run(postId)

        db.prepare(`
          INSERT INTO moderation_actions (
            moderator_id,
            board_id,
            action_type,
            post_id,
            thread_id,
            user_id,
            reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          perpetratorId,
          boardId,
          'shoot',
          postId,
          threadId,
          victimId,
          reason
        )
      }

      // ==================================================
      // 3. HIDE
      // ==================================================

      else if (actionType === 'hide') {
        if (post) {
          db.prepare(`
            UPDATE posts
            SET hid = 1
            WHERE id = ?
          `).run(postId)
        }
        else if (thread) {
          db.prepare(`
            UPDATE threads
            SET hid = 1
            WHERE id = ?
          `).run(threadId)
        }

        db.prepare(`
          INSERT INTO moderation_actions (
            moderator_id,
            board_id,
            action_type,
            post_id,
            thread_id,
            user_id,
            reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          perpetratorId,
          boardId,
          'hide',
          postId,
          threadId,
          victimId,
          reason
        )
      }

      // ==================================================
      // 4. DELETE
      // ==================================================

      else if (actionType === 'delete') {
        db.prepare(`
          INSERT INTO moderation_actions (
            moderator_id,
            board_id,
            action_type,
            post_id,
            thread_id,
            user_id,
            reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          perpetratorId,
          boardId,
          'delete',
          postId,
          threadId,
          victimId,
          reason
        )

        if (post) {
          db.prepare(`
            DELETE FROM posts
            WHERE id = ?
          `).run(postId)
        }
        else if (thread) {
          db.prepare(`
            DELETE FROM threads
            WHERE id = ?
          `).run(threadId)
        }
      }

      // ==================================================
      // 5. BAN
      // ==================================================

      else if (actionType === 'ban' && (!victim.is_owner || !victim.is_admin || !victim.is_mod)) {
        const expiresAt =
          length > 0
            ? now + length
            : null

        const banResult = db.prepare(`
          INSERT INTO bans (
            user_id,
            ip,
            session_id,
            board_id,
            post_id,
            expires_at,
            reason,
            banned_by,
            active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          victimId,
          victim.ip ?? null,
          victim.session_id ?? null,
          boardId,
          postId,
          expiresAt,
          reason,
          perpetratorId
        )

        const banId = banResult.lastInsertRowid

        db.prepare(`
          UPDATE users
          SET
            banned = 1,
            ban_count = COALESCE(ban_count, 0) + 1
          WHERE id = ?
        `).run(victimId)

        db.prepare(`
          INSERT INTO moderation_actions (
            moderator_id,
            board_id,
            action_type,
            post_id,
            thread_id,
            user_id,
            ban_id,
            reason,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          perpetratorId,
          boardId,
          'ban',
          postId,
          threadId,
          victimId,
          banId,
          reason,
          JSON.stringify({
            length,
            expires_at: expiresAt
          })
        )
      }
    })

    transaction()

    return {
      success: true,
      action: actionType,
      victimId,
      moderatorId: perpetratorId,
      postId,
      threadId
    }

  } catch (err) {
    console.error('moderationAction error:', err)

    return {
      success: false,
      error: err.message || 'Moderation action failed.'
    }
  }
}

function getModerationStatus(user, threadId) {
  if (!user?.id) {
    return {
      success: false,
      error: 'A valid user is required.'
    }
  }

  if (!threadId) {
    return {
      success: false,
      error: 'A valid thread ID is required.'
    }
  }

  try {
    const slap = db.prepare(`
      SELECT 1
      FROM slaps
      WHERE victim_id = ?
        AND thread_id = ?
      LIMIT 1
    `).get(user.id, threadId)

    const shot = db.prepare(`
      SELECT 1
      FROM shots
      WHERE victim_id = ?
        AND thread_id = ?
      LIMIT 1
    `).get(user.id, threadId)

    return {
      success: true,
      slapped: !!slap,
      shot: !!shot
    }

  } catch (err) {
    console.error('getModerationStatus error:', err)

    return {
      success: false,
      error: err.message || 'Unable to get moderation status.'
    }
  }
}
function deleteOldSlaps() {
  return db.prepare(`
    DELETE FROM slaps
    WHERE created_at < unixepoch() - 3600
  `).run()
}

function deletePost(postid) {
  db.prepare(`DELETE FROM posts WHERE id = ?`).run(postid)
}
function deleteThread(threadid, banflag, victim = null, perp = null) {
  db.prepare(`DELETE FROM threads WHERE id = ?`).run(threadid)
  if (banflag) {
 db.prepare(`
          INSERT INTO bans (
            user_id,
            ip,
            session_id,
            banned_by,
            active
          )
          VALUES (?, ?, ?, ?, 1)
        `).run(
          victim.id, victim.ip, victim.session_id, perp.id
        )
  }


}
function deleteMoshpit(moshpit) {
  db.prepare(`DELETE FROM moshpits WHERE title = ?`).run(moshpit)

}

function stickyThread(thread) {
  if (thread.sticky) {
  db.prepare(`UPDATE threads SET sticky = 0 WHERE id = ?`).run(thread.id)

  } else {
  db.prepare(`UPDATE threads SET sticky = 1 WHERE id = ?`).run(thread.id)

  }
}

function report(reporter, violator, rule, post_id = null, thread_id = null) {
  let html
  let ip
  if (post_id && !thread_id) {
   post = getPostAdmin(post_id)
   html = post.html
   ip = post.ip
  } else if (!post_id && thread_id) {
    thread = getThreadAdmin(thread_id)
   html = thread.html
   ip = thread.ip
  }

  db.prepare(`INSERT INTO reports (reporter_id, violator_id, rule_broken, post_id, thread_id, html, victim_ip) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(reporter, violator, rule, post_id, thread_id, html, ip)

}

function updatePerms(user_id) {
  db.prepare(`UPDATE users SET is_owner = 1 WHERE id = ?`).run(user_id)
}

function updateSettings(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p) {
  db.prepare(`UPDATE site_settings SET
    max_threads = ?, max_posts = ?, frozen = ?, silenced = ?, slowmode = ?,
    slowmode_multiplier = ?, thread_limit = ?, new_poster_timer_thread = ?,
    new_poster_timer_posts = ?, post_cooldown_thread = ?, post_cooldown_post = ?,
    bump_limit = ?, decay_timer = ?, report_cooldown = ?, announcement = ?, 
    announcement_status = ? WHERE id = 1`).run(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p)
}

function getReports() {
  return db.prepare(`SELECT * FROM reports WHERE report_status = 'pending' ORDER BY report_time ASC`).all()
}

function updateReport(threadId, postId) {
  console.log(threadId)
  console.log(postId)
  if (threadId) {
    db.prepare(`
    UPDATE reports
    SET report_status = 'resolved'
    WHERE thread_id = ?
`).run(
    threadId
)
  } else {
    db.prepare(`
    UPDATE reports
    SET report_status = 'resolved'
    WHERE post_id = ?
`).run(
    postId
)
  }
}

function deletePORT(threadid, postid) {
  if (threadid) {
    db.prepare(`DELETE FROM threads WHERE id = ?`).run(threadid.id)
  } else if (postid) {
    db.prepare(`DELETE FROM posts WHERE id = ?`).run(postid.id)
  }
}

function deleteAllReports(userid) {
db.prepare(`DELETE FROM reports WHERE reporter_id = ?`).run(userid)
}

function getAllThreads(offset = 0) {
 return db.prepare(`SELECT
    t.,
    m.title AS moshpit_title
FROM threads t
JOIN moshpits m
    ON m.id = t.board_id
WHERE
    m.hid = 0
    AND m.is_disabled = 0
    AND t.hid = 0
    AND t.deleted_at IS NULL
    AND m.id IN (
        SELECT id
        FROM moshpits
        WHERE hid = 0
          AND is_disabled = 0
        ORDER BY thread_count DESC, id DESC
        LIMIT 100
    )
ORDER BY t.bumped_at DESC, t.id DESC
LIMIT 100
OFFSET ? * 100;`).all(offset)
}

function addColumnIfNotExists(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();

  const exists = columns.some(col => col.name === column);

  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
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
  updatePostCount,
  bumpThread,
  updateThread,
  getNewPosts,
  getSettings,
  setCachedResults,
  getCachedResults,
  refreshCache,
  deleteOldThreads,
  deleteLowThreads,
  checkPostCreation,
  getPostAdmin,
  getUserAdmin,
  moderationAction,
  getModerationStatus,
  deleteOldSlaps,
  getThreadAdmin,
  deletePost,
  deleteThread,
  deleteMoshpit,
  stickyThread,
  report,
  getUserAdminCookie,
  updatePerms,
  updateSettings,
  getReports,
  updateReport,
  deletePORT,
  deleteAllReports,
  getThreadsThread,
  getAllThreads,
  addColumnIfNotExists
}
