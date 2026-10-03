const express = require('express')
const path = require('path')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
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
  getNewPosts,
  getSettings,
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
stickyThread
 } = require('./db-queries')
const { Reader } = require('@maxmind/geoip2-node')

const app = express()

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
        const user = await createUser(sessionId, ip, response.country.isoCode)
      } else {
        sessionId = crypto.randomUUID()

        const user = await createUser(sessionId, ip, response.country.isoCode)
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


app.get('/api', (req, res) => {
  res.redirect('/')
})

app.get('/', async (req, res) => {
  const threads = await getThreads('moshpit')
    const user = await getUser(req.sessionId)
  const results = await getCachedResults()
  const settings = await getSettings()
  if (!threads || !results ) {
    return res.status(404).send('No threads found, make one?')
  }
  const moshpit = 'moshpit'
  res.render('index', { threads, moshpit, trending: results.trending, recent: results.recent, popular: results.popular, user, settings })
})

app.get('/quirks', async (req, res) => {
  const results = await getCachedResults()
  const settings = await getSettings()

  res.render('quirks', {trending: results.trending, recent: results.recent, settings})
})

app.get('/faq', async (req, res) => {
      const results = await getCachedResults()

  const settings = await getSettings()

  res.render('faq', {trending: results.trending, recent: results.recent, settings})
})

app.get('/rules', async (req, res) => {
   const results = await getCachedResults()
  const settings = await getSettings()

  res.render('rules', {trending: results.trending,  recent: results.recent,settings})
})

app.get('/moshpits', async (req, res) => {
  const results = await getCachedResults()

  const settings = await getSettings()

  res.render('moshpits', {trending: results.trending, settings, popular: results.popular, recent: results.recent})
})

app.get('/:moshpit', async (req, res) => {
  const results = await getCachedResults()
  const { moshpit } = req.params

  const user = await getUser(req.sessionId)
  const threads = await getThreads(moshpit)
  const trending = await getTrendingMoshpits()
  const settings = await getSettings()


  // if (!threads || !trending) {
  //   return res.status(404).send('No threads found, make one?')
  // }

  res.render('index', { threads, moshpit, trending: results.trending, recent: results.recent, user, settings})
})

app.get('/:moshpit_title/:thread_id', async (req, res) => {
  const { thread_id } = req.params
  const { moshpit_title } = req.params
  const results = await getCachedResults()
  const thread = await getThread(thread_id)
  
  if (!thread) {
    return res.redirect(`/${moshpit_title}`)
  }
  const user = await getUser(req.sessionId)
  const posts = await getPosts(thread_id)
  const moshpit = await getOrCreateMoshpit(thread.moshpit)
  const settings = await getSettings()

  res.render('thread', { thread, posts, user, moshpit, trending: results.trending, recent: results.recent, settings })
})

// -------------------------
// API routes
// -------------------------
app.get('/api/refresh/:moshpit/:thread_id/:last_post', async (req, res) => {
  const { thread_id } = req.params
  let { last_post } = req.params
  let { moshpit } = req.params
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
  if (last_post === 'OP') {
      last_post = '1'
    }
  let posts = await getNewPosts(thread_id, last_post)
  let moshpitcreate = await getOrCreateMoshpit(moshpit)
   if (moshpitcreate.flags == 0) {
      posts.forEach(post => {
        post.country = 'nigga stop looking here bitch'
      })
    }
  return res.json({
      posts: posts,
    })
})
app.post('/api/sticky', async (req, res) => { 
    const perp = await getUser(req.sessionId)

  if (!perp) {
      return res.status(400).json({
        error: 'Missing perp'
      })
  }
  console.log(perp.is_owner)
if (perp.is_admin || perp.is_owner) {
 const thread_id = req.body.thread_id

if (!thread_id) {
    return res.status(400).json({
        error: 'Missing thread id'
      })
  }
  const thread = await getThreadAdmin(thread_id)

  if (!thread) {
    return res.status(400).json({
        error: 'Missing thread'
      })
  }

  stickyThread(thread)
return res.status(200)
}
  
return res.status(400).json({
        error: 'Missing permissions'
      })
   
})
app.post('/api/swag', async (req, res) => { 
  const thread_id = req.body.thread_id
  const banflag = req.body.banflag

if (!thread_id) {
    return res.status(400).json({
        error: 'Missing thread id'
      })
  }
  const thread = await getThreadAdmin(thread_id)

  if (!thread) {
    return res.status(400).json({
        error: 'Missing thread'
      })
  }

  const perp = await getUser(req.sessionId)

  if (!perp) {
      return res.status(400).json({
        error: 'Missing perp'
      })
  }
 
if (perp.is_admin || perp.is_owner || perp.is_mod) {
  if (banflag == 0) {
  deleteThread(thread.id, banflag)

  return res.json({
      success: true,
      message: 'THREAD WAS DELETED'
    })
}

  const user = await getUserAdmin(thread.author_id)

  if (!user) {
    return res.status(400).json({
        error: 'Missing user'
      })
  } 

  deleteThread(thread_id, banflag, user, perp)


   return res.status(200)
}
 return res.status(400).json({
        error: 'Missing permissions'
      })

})
app.post('/api/slap', async (req, res) => {
     const perp = await getUser(req.sessionId)

    if (!perp) {
      return res.status(401).json({
        error: 'You must be logged in'
      })
    }
  try {
 
    const post_id = req.body.post_id

    if (!post_id) {
      return res.status(400).json({
        error: 'Missing post_id'
      })
    }

    const post = await getPostAdmin(post_id)

    if (!post) {
      return res.status(404).json({
        error: 'Post not found'
      })
    }

    const user = await getUserAdmin(post.author_id)

    if (!user) {
      return res.status(404).json({
        error: 'Post author not found'
      })
    }

    const status = await getModerationStatus(
      user,
      post.thread_id
    )

    if (post.slapped) {
   
      return res.json({
      success: true,
      message: 'USER WAS SLAPPED'
    })
    }

   
    const result = await moderationAction(
      user,
      perp,
      post,
      null,
      req.body.action,
      0,
      ''
    )

    if (!result.success) {

      return res.status(422).json({
        error: result.error
      })
    }
      

    return res.json({
      success: true,
      message: 'USER WAS SLAPPED'
    })

  } catch (err) {
    console.error('POST /api/slap error:', err)

    return res.status(500).json({
      error: 'Internal server error'
    })
  }
})
app.post('/api/shoot', async (req, res) => {
    const perp = await getUser(req.sessionId)

    if (!perp) {
      return res.status(401).json({
        error: 'You must be logged in'
      })
    }
 

  try {

    const post_id = req.body.post_id

    if (!post_id) {
      return res.status(400).json({
        error: 'Missing post_id'
      })
    }

    const post = await getPostAdmin(post_id)

    if (!post) {
      return res.status(404).json({
        error: 'Post not found'
      })
    }

    const user = await getUserAdmin(post.author_id)

    if (!user) {
      return res.status(404).json({
        error: 'Post author not found'
      })
    }

    const status = await getModerationStatus(
      user,
      post.thread_id
    )

    if (post.shot) {
      return res.json({
      success: true,
      message: 'USER WAS SHOT'
    })
    }

    
    const result = await moderationAction(
      user,
      perp,
      post,
      null,
      req.body.action,
      0,
      ''
    )

    if (!result.success) {
   

      return res.status(422).json({
        error: result.error
      })
    }
      

    return res.json({
      success: true,
      message: 'USER WAS SHOT'
    })

  } catch (err) {
    console.error('POST /api/shoot error:', err)

    return res.status(500).json({
      error: 'Internal server error'
    })
  }
})
app.post('/api/hide', async (req, res) => {
    

  try {

    const post_id = req.body.post_id
    const thread_id = req.body.thread_id
    if (!post_id && !thread_id) {
      return res.status(400).json({
        error: 'Missing id'
      })
    }

    const post = await getPostAdmin(post_id)
    const thread = await getThreadAdmin(thread_id)
    if (!post && !thread) {
      return res.status(404).json({
        error: 'Post not found'
      })
    }
    if (post && thread) {
      return res.status(422).json({
        error: 'Cannot have a post and a thread'
      })
    }

  if ((post && post.hid === 1) || (thread && thread.hid === 1)) {
  return res.status(422).json({
    error: 'Post is already hidden'
  })
}
    let user
    let objek
     if (post && !thread) {
      user = await getUserAdmin(post.author_id)
      
      }
    if (!post && thread) {
      user = await getUserAdmin(thread.author_id)
      }

    if (!user) {
      return res.status(404).json({
        error: 'Post author not found'
      })
    }

  if (post && !thread) {
      if (post.hid) {
      return res.json({
      success: true,
      message: 'POST HAS BEEN HIDDEN'
    })
    }
      
      }
    if (!post && thread) {
       if (thread.hid) {
      return res.json({
      success: true,
      message: 'THREAD HAS BEEN HIDDEN'
    })
    }
      }

    

    const perp = await getUser(req.sessionId)

    if (!perp) {
      return res.status(401).json({
        error: 'You must be logged in'
      })
    }

    const result = await moderationAction(
      user,
      perp,
      post,
      thread,
      req.body.action,
      0,
      ''
    )

    if (!result.success) {
     

      return res.status(422).json({
        error: result.error
      })
    }
      

    return res.json({
      success: true,
      message: 'USER HAS BEEN HIDDEN'
    })

  } catch (err) {
    console.error('POST /api/hide error:', err)

    return res.status(500).json({
      error: 'Internal server error'
    })
  }
})
app.post('/api/delete', async (req, res) => {
   const perp = await getUser(req.sessionId)

    if (!perp) {
      return res.status(401).json({
        error: 'You must be logged in'
      })
    }
  if (perp.is_admin || perp.is_owner || perp.is_mod) {
  try {

    const post_id = req.body.post_id
    const thread_id = req.body.thread_id
    if (!post_id && !thread_id) {
      return res.status(400).json({
        error: 'Missing id'
      })
    }

    const post = await getPostAdmin(post_id)
    const thread = await getThreadAdmin(thread_id)
    if (!post && !thread) {
      return res.status(404).json({
        error: 'Post not found'
      })
    }
    if (post && thread) {
      return res.status(422).json({
        error: 'Cannot have a post and a thread'
      })
    }

    let user
     if (post && !thread) {
      user = await getUserAdmin(post.author_id)
      
      }
    if (!post && thread) {
      user = await getUserAdmin(thread.author_id)
      }

    if (!user) {
      return res.status(404).json({
        error: 'Post author not found'
      })
    }


    const result = await moderationAction(
      user,
      perp,
      post,
      thread,
      req.body.action,
      0,
      ''
    )

    if (!result.success) {
      return res.status(422).json({
        error: result.error
      })
    }

    return res.json({
      success: true,
      message: 'POST HAS BEEN DELETED'
    })

  } catch (err) {
    console.error('POST /api/delete error:', err)

    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}
  return res.status(422).json({
        error: 'missing perms'
      })
})
app.post('/api/ban', async (req, res) => {
   const perp = await getUser(req.sessionId)

    if (!perp) {
      return res.status(401).json({
        error: 'You must be logged in'
      })
    } 
  if (perp.is_admin || perp.is_owner || perp.is_mod) {
 try {

    const post_id = req.body.post_id
    const thread_id = req.body.thread_id
    if (!post_id && !thread_id) {
      return res.status(400).json({
        error: 'Missing id'
      })
    }

    const post = await getPostAdmin(post_id)
    const thread = await getThreadAdmin(thread_id)
    if (!post && !thread) {
      return res.status(404).json({
        error: 'Post not found'
      })
    }
    if (post && thread) {
      return res.status(422).json({
        error: 'Cannot have a post and a thread'
      })
    }

    let user
     if (post && !thread) {
      user = await getUserAdmin(post.author_id)
      
      }
    if (!post && thread) {
      user = await getUserAdmin(thread.author_id)
      }

    if (!user) {
      return res.status(404).json({
        error: 'Post author not found'
      })
    }


    const result = await moderationAction(
      user,
      perp,
      post,
      thread,
      req.body.action,
      0,
      'manual ban'
    )

    if (!result.success) {
      return res.status(422).json({
        error: result.error
      })
    }

    return res.json({
      success: true,
      message: 'USER HAS BEEN BANNED'
    })

  } catch (err) {
    console.error('POST /api/ban error:', err)

    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}
  return res.status(400).json({
        error: 'Missing permissions'
      })
})
let banned_words = ['admin', 'vip', 'faq', 'rules', 'moshpits', 'login', 'quirks', 'nigger', 'rape', 'rapist', 'spic', 'spics', 'faggy', 'fag', 'niggers', 'rapists', 'honky', 'chink', 'chinks', 'kike', 'faggot', 'loli', 'shota', 'cp', 'csam', '1488', '14', '88', 'HH', 'hitler', 'adolf', 'tnd', 'tkd', 'tranny', 'troon', 'nazi']
app.post('/api/create/post', async (req, res) => {
  try {
    const text = req.body.text
    const thread_id = req.body.thread_id
    const html = req.body.html
    const trick = req.body.post_text1
    const settings = await getSettings()
    if (!text || !text.trim()) {
      return res.status(400).json({
        error: 'Post cannot be empty'
      })
    }
    if (text.length > 4000) {
      return res.status(422).json({
        error: 'Post too long (4000 chars max)'
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
 if (trick) {
    banUser(user, 'You have been banned', "Sus activity")
  }
     if (!req.body.moshpit) {
      return res.status(400).json({
        error: 'moshpit cannot be empty'
      })
    }
const containsBannedWord = banned_words.some(word =>
new RegExp(`\\b${word}\\b`, 'i').test(req.body.moshpit)
)

if (containsBannedWord) {
  return res.status(422).json({
    error: 'moshpit titles cannot contain banned words'
  })
}

let moshpit = await getOrCreateMoshpit(req.body.moshpit)

  const check = await checkPostCreation(user, moshpit, 'post', thread_id)
   if (check.error) {
  return res.status(422).json({
    error: check.error
  })
}
    const now = Math.floor(Date.now() /1000)

    const reader = await Reader.open('./GeoLite2-City.mmdb')
    const response = reader.city('162.204.244.204')

    const lastPost = await getLastPost(thread_id)

    const post_number = (lastPost?.post_number ?? 0) + 1

    let post = await createPost(
      user.id,
      req.ip,
      thread_id,
      moshpit.id,
      text,
      post_number,
      response.country.isoCode,
      now,
      formatText(html)
    )
    post.ip = ''
    // 
    await updatePostCount(thread_id, moshpit.title)
    await updateThread(now, thread_id)
    await bumpThread(now, thread_id)
    if (moshpit.flags == 0) {
      post.country = 'Chiraq'
    }
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
  let trick = req.body.post_text

 
 if (!text || !text.trim()) {
      return res.status(400).json({
        error: 'Thread cannot be empty'
      })
    }
    if (text.length > 4000) {
      return res.status(422).json({
        error: 'Thread too long (4000 chars max)'
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
    
  }
  if (!regex.test(moshpit)) {
    return res.status(400).json({
      error: 'only alphanumeric characters are allowed for moshpit titles'
    })
   
  }
  const containsBannedWord = banned_words.some(word =>
new RegExp(`\\b${word}\\b`, 'i').test(moshpit)
)

if (containsBannedWord) {
  return res.status(422).json({
    error: 'moshpit titles cannot contain banned words'
  })
}

  const user = await getUser(req.sessionId)
   if (trick) {
    banUser(user, 'You have been banned', "Sus activity")
  }
  moshpit = await getOrCreateMoshpit(moshpit.toLowerCase())
const check = await checkPostCreation(user, moshpit, 'thread')
   if (check.error) {
  return res.status(422).json({
    error: check.error
  })
}
  if (user) {
    const now = Math.floor(Date.now() /1000)
    const reader = await Reader.open('./GeoLite2-City.mmdb')
    const response = reader.city('162.204.244.204')
    const thread = await createThread(
      user.id,
      moshpit.title,
      text,
      now,
      now,
      moshpit.id,
      formatText(html),
      req.ip,
      response.country.isoCode
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
function formatText(post) {
        let comment = ''
        if (!post) {
          return '' 
        } else if (!post.comment) {
          comment = post
        } else {
          comment = post.comment
        }
        const escaper = /(\s*)[<](\s*)/g
        comment = comment.replaceAll(escaper, `$1&lt;$2`)
        
       comment = partytext(comment).trimEnd()
        const regex = /@([0-9\s+]+|[OP\s+]+)/g
        const regex2 = /#(?!quirks(?=$|[^A-Za-z0-9\s+])|faq(?=$|[^A-Za-z0-9\s+])|rules(?=$|[^A-Za-z0-9\s+])|moshpits(?=$|[^A-Za-z0-9\s+])|vip(?=$|[^A-Za-z0-9\s+])|login(?=$|[^A-Za-z0-9\s+])|admin(?=$|[^A-Za-z0-9\s+]))([A-Za-z0-9\s+]{1,7})(?![A-Za-z0-9\s+])/gi

        comment = comment.replaceAll(regex2, `<a href="#$1" class="pitquote" style="color: var(--rage);">#$1</a>`)
        return comment.replace(
          regex,
          `<a href="#$1" class="quote" data-quoteid="$1" style="color: var(--rage);">@$1</a>`
        )
      }

      function partytext(c) {
        const spoiler = /\[\[\[([\s\S]*?)]]]/g
        let comment = c.replace(spoiler, `<s>$1</s>`)
        const array1 = comment.split("\n")
   
        let comment1 = ''
        const shake1 = /\[s1\]([\s\S]*?)\[\/s1\]/g
        const shake2 = /\[s2\]([\s\S]*?)\[\/s2\]/g
        const shake3 = /\[s3\]([\s\S]*?)\[\/s3\]/g
        const shake3a = /\[s3a\]([\s\S]*?)\[\/s3a\]/g
        const hori1 = /\[h1\]([\s\S]*?)\[\/h1\]/g
        const hori2 = /\[h2\]([\s\S]*?)\[\/h2\]/g
        const hori3 = /\[h3\]([\s\S]*?)\[\/h3\]/g
        const hori3a = /\[h3a\]([\s\S]*?)\[\/h3a\]/g
        const gay = /\[r\]([\s\S]*?)\[\/r\]/g
        const trans = /\[t\]([\s\S]*?)\[\/t\]/g
        const schizo = /\[tv\]([\s\S]*?)\[\/tv\]/g
        const schizoa = /\[tva\]([\s\S]*?)\[\/tva\]/g
        const yay = /\[v\]([\s\S]*?)\[\/v\]/g
        const yaya = /\[va\]([\s\S]*?)\[\/va\]/g
        const police = /\[p\]([\s\S]*?)\[\/p\]/g
        const bold = /\[b\]([\s\S]*?)\[\/b\]/g
        const italic = /\[i\]([\s\S]*?)\[\/i\]/g
        const big = /\[big\]([\s\S]*?)\[\/big\]/g
        const rage = /\[red\]([\s\S]*?)\[\/red\]/g

        const glow = /\[g\]([\s\S]*?)\[\/g\]/g
        array1.forEach((c) => {
         
            let pre = ''
            let end = ''
            if (c.startsWith('>')&& !c.startsWith('> ')) {
               pre = '<span class="greentext">' + pre
              end = end + '</span>'
            } else if (c.toLowerCase().startsWith("im gay") || c.toLowerCase().startsWith("i'm gay")) {
             pre = '<span class="gay">' + pre
              end = end + '</span>'
            } else if (c.toLowerCase().startsWith("im trans") || c.toLowerCase().startsWith("i'm trans")) {
             pre = '<span class="trans">' + pre
              end = end + '</span>'
            } else if (c.startsWith("THE VOICES")) {
             pre = '<span class="schizo">' + pre
              end = end + '</span>'
            }else if (c.toLowerCase().startsWith("yay")) {
             pre = '<span class="vert">' + pre
              end = end + '</span>'
            }else if (c.startsWith("POLICE")) {
             pre = '<span class="police">' + pre
              end = end + '</span>'
            }else if (c.startsWith("FUCK") || c.startsWith("WTF")) {
             pre = '<span class="rage">' + pre
              end = end + '</span>'
            }
          if (c.endsWith('!!!!!')) {
          //  comment1 = comment1 + '<span class="shake3">' + c + '</span>' + "\n"
           pre = '<span class="shake3">' + pre
          end = end + '</span>'
          
        } else if (c.endsWith('!!!!')) {
           pre = '<span class="shake2">' + pre
          end = end + '</span>'
          } else if (c.endsWith('!!!')) {
           pre = '<span class="shake1">' + pre
          end = end + '</span>'
        } else if (c.endsWith('....!')) {
           pre = '<span class="hori3">' + pre
          end = end + '</span>'
          } else if (c.endsWith('...!')) {
           pre = '<span class="hori2">' + pre
          end = end + '</span>'
        } else if (c.endsWith('..!')) {
           pre = '<span class="hori1">' + pre
          end = end + '</span>' } 
          else if (c.endsWith('?!?!?') || c.endsWith('!?!?!')) {
           pre = '<span class="shake3">' + pre
          end = end + '</span>'
          
        } else if (c.endsWith('?!?!') || c.endsWith('!?!?')) {
           pre = '<span class="shake2">' + pre
          end = end + '</span>'
          } else if (c.endsWith('?!?') || c.endsWith('!?!')) {
           pre = '<span class="shake1">' + pre
          end = end + '</span>'
        }else if (c.endsWith('.....')) {
           pre = '<span class="italic3">' + pre
          end = end + '</span>'
          } else if (c.endsWith('....')) {
           pre = '<span class="italic2">' + pre
          end = end + '</span>'
        } else if (c.endsWith('...')) {
           pre = '<span class="italic1">' + pre
          end = end + '</span>' } 
          
          else if(c === ''){
          
        } else {
          
           
           
        }
        comment1 = comment1 + pre + c + end + "\n"
        comment1 = comment1.replace(shake3a, '<span class="shake3a">$1</span>')
        comment1 = comment1.replace(shake3, '<span class="shake3">$1</span>')
        comment1 = comment1.replace(shake2, '<span class="shake2">$1</span>')
        comment1 = comment1.replace(shake1, '<span class="shake1">$1</span>')

        comment1 = comment1.replace(hori3a, '<span class="hori3a">$1</span>')
        comment1 = comment1.replace(hori3, '<span class="hori3">$1</span>')
        comment1 = comment1.replace(hori2, '<span class="hori2">$1</span>')
        comment1 = comment1.replace(hori1, '<span class="hori1">$1</span>')
        
        comment1 = comment1.replace(glow, '<span class="glow">$1</span>')
        comment1 = comment1.replace(gay, '<span class="gay">$1</span>')
        comment1 = comment1.replace(trans, '<span class="trans">$1</span>')
        comment1 = comment1.replace(schizo, '<span class="schizo">$1</span>')
        comment1 = comment1.replace(schizoa, '<span class="schizoa">$1</span>')
        comment1 = comment1.replace(yay, '<span class="vert">$1</span>')
        comment1 = comment1.replace(yaya, '<span class="verta">$1</span>')
        comment1 = comment1.replace(police, '<span class="police">$1</span>')
        comment1 = comment1.replace(rage, '<span class="rage">$1</span>')
        comment1 = comment1.replace(big, '<span class="big">$1</span>')
        comment1 = comment1.replace(bold, '<span class="bold">$1</span>')
        comment1 = comment1.replace(italic, '<span class="italic">$1</span>')


    
        })
        
        return comment1
      }
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


deleteOldThreads()
refreshCache()
deleteLowThreads()
deleteOldSlaps
app.listen(3000, () => {
  console.log('Running at http://localhost:3000')
  setInterval(() => {deleteLowThreads()}, 100000)
  setInterval(() => {deleteOldSlaps()}, 15000)

  setInterval(() => { refreshCache() }, 15000)
  setInterval(() => {deleteOldThreads()}, getSettings().decay_timer * 1000)
})
