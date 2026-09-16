const express = require('express')
const path = require('path')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
const EventEmitter = require('events')
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
  getOrCreateMoshpit
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

    if (!sessionId) {
      const ip = req.ip
      const reader = await Reader.open('./GeoLite2-City.mmdb')
      const response = reader.city('162.204.244.204')

      sessionId = crypto.randomUUID()

      const user = await createUser(sessionId, ip, response.country.names.en)

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10
      })

      console.log('Created new user:', sessionId)
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
// Page routes
// -------------------------

app.get('/api', (req, res) => {
  res.redirect('/')
})

app.get('/', async (req, res) => {
  const threads = await getThreads('moshpit');
  const trending = await getTrendingMoshpits()
  console.log(trending[0])
  const popular = await getPopularMoshpits()
  const recent = await getRecentMoshpits()
  if (!threads || !trending || !popular || !recent) {
    return res.status(404).send('No threads found, make one?');
  }

  res.render('index', { threads, trending, popular, recent });
})

app.get('/quirks', (req, res) => {
  res.sendFile(path.join(__dirname, 'quirks.html'))
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
  const { moshpit } = req.params;

  const threads = await getThreads(moshpit);
  const trending = await getTrendingMoshpits()
  console.log(trending)
  const popular = await getPopularMoshpits()
  const recent = await getRecentMoshpits()

  if (!threads || !trending) {
    return res.status(404).send('No threads found, make one?');
  }

  res.render('index', { threads, trending, popular, recent });
})

app.get('/:moshpit/:thread_id', async (req, res) => {
  const { thread_id } = req.params;

  const thread = await getThread(thread_id);

  if (!thread) {
    return res.status(404).send('Thread not found');
  }

  res.render('thread', { thread });
})
// -------------------------
// Server-Sent Events
// -------------------------

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendThread = thread => {
    res.write(`event: new-thread\n`)
    res.write(`data: ${JSON.stringify(thread)}\n\n`)
  }

  events.on('new-thread', sendThread)

  req.on('close', () => {
    events.off('new-thread', sendThread)
  })
})

// -------------------------
// API routes
// -------------------------

app.post('/api/create/thread', (req, res) => {
  const text = req.body.text
  let moshpit = req.body.moshpit
  if (!text || !text.trim()) {
    return res.status(400).json({
      error: 'Thread cannot be empty'
    })
  }

  if (!moshpit) {
    moshpit = 'moshpit' 
  }
  const user = getUser(req.sessionId)
  moshpit = getOrCreateMoshpit(moshpit, user.id)
  console.log(moshpit)
  if (user) {
    const now = new Date().toISOString()
  
    const thread = createThread(
      user.id,
      moshpit.title,
      text.trim(),
      now,
      now
    )
    // res.json(thread)
    return res.json({
    threadId: thread.id,
    moshpit: moshpit
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
