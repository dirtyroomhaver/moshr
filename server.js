const express = require('express');
const path = require('path');
const { createThread } = require('./db');
const EventEmitter = require('events');

const app = express();
const events = new EventEmitter();

app.use(express.static(__dirname));
app.use(express.json());
app.get('/api', (req, res) => {
    res.redirect('/')
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});



app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendThread = (thread) => {
        res.write(`event: new-thread\n`);
        res.write(`data: ${JSON.stringify(thread)}\n\n`);
    };

    events.on('new-thread', sendThread);

    
    req.on('close', () => {
        events.off('new-thread', sendThread);
    });
});



app.post('/api/threads', (req, res) => {
    const text = req.body.text;

    if (!text || !text.trim()) {
        return res.status(400).json({
            error: 'Thread cannot be empty'
        });
    }

    const thread = createThread(text.trim());

    // Send thread to all connected SSE clients
    events.emit('new-thread', thread);

    // Tell the POST request that everything worked
    res.json(thread);
});


app.listen(3000, () => {
    console.log('Running at http://localhost:3000');
});