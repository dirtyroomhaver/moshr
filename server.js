const express = require('express')
const path = require('path')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
const EventEmitter = require('events')
const bcrypt = require('bcrypt')
const {
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
  getNewPosts
} = require('./db-queries')
const { Reader } = require('@maxmind/geoip2-node')

const app = express()
const events = new EventEmitter()
app.set('view engine', 'ejs')
// -------------------------
// Middleware
// -------------------------

app.use(cookieParser())
app.use(express.json())

// Don't allow users to access .html files directly.
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    return res.status(404).send('Not Found')
  }

  next()
})

// -------------------------
// User / Session middleware
// -------------------------

app.use(async (req, res, next) => {
  try {
    let sessionId = req.cookies.sessionId
    const cuser = await getUser(sessionId)
    if (!cuser) {
      const ip = req.ip
      const reader = await Reader.open('./GeoLite2-City.mmdb')
      const response = reader.city('162.204.244.204')
  
      if (sessionId) {
        const user = await createUser(sessionId, ip, response.country.names.en)
      } else {
        sessionId = crypto.randomUUID()

        const user = await createUser(sessionId, ip, response.country.names.en)
      }

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10
      })

      console.log('Created new user:', sessionId)
    } else {
    }

    // Eventually you can look up the user here:
    //
    // req.user = await getUserBySessionId(sessionId);

    req.sessionId = sessionId

    next()
  } catch (error) {
    next(error)
  }
})

// -------------------------
// Static files
// -------------------------

app.use(express.static(__dirname))
// -------------------------
// Server-Sent Events
// -------------------------
let countr = 0
// app.get('/api/events', (req, res) => {
//   res.setHeader('Content-Type', 'text/event-stream')
//   res.setHeader('Cache-Control', 'no-cache')
//   res.setHeader('Connection', 'keep-alive')

//   const threadId = req.query.thread_id

//   console.log('SSE connection for thread:', countr++)

//   const sendPost = post => {
//     // Only send this post to clients watching this thread
//     if (String(post.thread_id) !== String(threadId)) {
//       return
//     }

//     res.write(`event: new-post\n`)
//     res.write(`data: ${JSON.stringify(post)}\n\n`)
//   }

//   events.on('new-post', sendPost)

//   // Tell the browser that the connection is alive
//   res.write(`: connected\n\n`)

//   req.on('close', () => {
//     console.log('SSE connection closed:', threadId)
//     events.off('new-post', sendPost)
//   })
// })
// -------------------------
// Page routes
// -------------------------

app.get('/api', (req, res) => {
  res.redirect('/')
})

app.get('/', async (req, res) => {
  const threads = await getThreads('moshpit')
    const user = getUser(req.sessionId)
  const trending = await getTrendingMoshpits()
  const popular = await getPopularMoshpits()
  const recent = await getRecentMoshpits()
  if (!threads || !trending || !popular || !recent) {
    return res.status(404).send('No threads found, make one?')
  }
  const moshpit = 'moshpit'
  res.render('index', { threads, moshpit, trending, popular, recent, user })
})

app.get('/quirks', async (req, res) => {
  const trending = await getTrendingMoshpits()
  res.render('quirks', {trending})
})

app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'faq.html'))
})

app.get('/rules', (req, res) => {
  res.sendFile(path.join(__dirname, 'rules.html'))
})

app.get('/moshpits', (req, res) => {
  res.sendFile(path.join(__dirname, 'moshpits.html'))
})

app.get('/thread', (req, res) => {
  res.sendFile(path.join(__dirname, 'thread.html'))
})

app.get('/:moshpit', async (req, res) => {
  const { moshpit } = req.params
  const user = getUser(req.sessionId)
  const threads = await getThreads(moshpit)
  const trending = await getTrendingMoshpits()

  const popular = await getPopularMoshpits()
  const recent = await getRecentMoshpits()

  if (!threads || !trending) {
    return res.status(404).send('No threads found, make one?')
  }

  res.render('index', { threads, moshpit, trending, popular, recent, user })
})

app.get('/:moshpit/:thread_id', async (req, res) => {
  const { thread_id } = req.params
  const trending = await getTrendingMoshpits()
  const thread = await getThread(thread_id)

  if (!thread) {
    return res.status(404).send('Thread not found')
  }
  const user = await getUser(req.sessionId)
  const posts = await getPosts(thread_id)
  const moshpit = await getOrCreateMoshpit(thread.moshpit)
  res.render('thread', { thread, posts, user, moshpit, trending })
})

// -------------------------
// API routes
// -------------------------
app.get('/api/refresh/:thread_id/:last_post', async (req, res) => {
  const { thread_id } = req.params
  const { last_post } = req.params
  if (!thread_id) {
      return res.status(400).json({
        error: 'thread_id cannot be empty'
      })
    }
  if (!last_post) {
      return res.status(400).json({
        error: 'last_post cannot be empty'
      })
    }

  const posts = await getNewPosts(thread_id, last_post)

  return res.json({
      posts: posts,
    })
})
app.post('/api/create/post', async (req, res, next) => {
  try {
    const text = req.body.text
    const thread_id = req.body.thread_id
    const html = req.body.html
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        error: 'Post cannot be empty'
      })
    }

    if (!thread_id) {
      return res.status(400).json({
        error: 'thread_id cannot be empty'
      })
    }

    const user = await getUser(req.sessionId)

    if (!user) {
      return res.status(400).json({
        error: 'User not found'
      })
    }

    const moshpit = await getOrCreateMoshpit(req.body.moshpit, user.id)

    if (!moshpit) {
      return res.status(400).json({
        error: 'moshpit cannot be empty'
      })
    }

    const now = Math.floor(Date.now() /1000)

    const reader = await Reader.open('./GeoLite2-City.mmdb')
    const response = reader.city('162.204.244.204')

    const lastPost = await getLastPost(thread_id)

    const post_number = (lastPost?.post_number ?? 0) + 1

    const post = await createPost(
      user.id,
      '162.204.244.204',
      thread_id,
      moshpit.id,
      text,
      post_number,
      response.country.names.en,
      now,
      html
    )

    updatePostCount(thread_id)
    updateThread(now, thread_id)
    bumpThread(now, thread_id)
    
    // Respond to the POST request
    return res.json({
      post: post,
      moshpit: moshpit
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/create/thread', async (req, res) => {
  const text = req.body.text
  const html = req.body.html
  let moshpit = req.body.moshpit
  if (!text || !text.trim()) {
    return res.status(400).json({
      error: 'Thread cannot be empty'
    })
  }

  if (!moshpit) {
    moshpit = 'moshpit'
  }
  const regex = /^[a-z0-9]+$/i
  if (moshpit.length > 7) {
    return res.status(400).json({
      error: 'moshpit titles cannot be over 7 characters long'
    })
    
  } else if (!regex.test(moshpit)) {
    return res.status(400).json({
      error: 'only alphanumeric characters are allowed for moshpit titles'
    })
   
  }
  const user = getUser(req.sessionId)
  moshpit = getOrCreateMoshpit(moshpit.toLowerCase(), user.id)

  if (user) {
    const now = Math.floor(Date.now() /1000)
    const reader = await Reader.open('./GeoLite2-City.mmdb')
    const response = reader.city('162.204.244.204')
    const thread = createThread(
      user.id,
      moshpit.title,
      text,
      now,
      now,
      moshpit.id,
      html,
      '162.204.244.204',
      response.country.names.en
    )
    // res.json(thread)
    return res.json({
      threadId: thread.id,
      moshpit: moshpit,
    })
  }

  // events.emit('new-thread', thread)
  res.status(400).json({
    error: 'Error'
  })
})

// -------------------------
// Error handling
// -------------------------

app.use((err, req, res, next) => {
  console.error(err)

  res.status(500).json({
    error: 'Internal server error'
  })
})

// -------------------------
// Start server
// -------------------------

app.listen(3000, () => {
  console.log('Running at http://localhost:3000')
})
