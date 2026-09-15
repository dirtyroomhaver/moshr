const {db} = require('./db');
// -------------------------
// USER
// -------------------------
function getUser(cookie) {
    return db.prepare(`
        SELECT *
        FROM users
        WHERE cookie = ?
    `).get(cookie);
}
function createUser(session_id, ip, country) {
    return db.prepare(`
        INSERT INTO users (session_id, ip, country)
        VALUES (?, ?, ?)
        RETURNING *
    `).get(session_id, ip, country);
}
function banUser(text) {
    return db.prepare(`
        INSERT INTO threads (thread_text)
        VALUES (?)
        RETURNING *
    `).get(text);
}
function createThread(text) {
    return db.prepare(`
        INSERT INTO threads (thread_text)
        VALUES (?)
        RETURNING *
    `).get(text);
}
module.exports = {
    getUser, createUser, banUser, createThread
}