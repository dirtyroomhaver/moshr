const Database = require('better-sqlite3')
const fs = require('node:fs')
const path = require('node:path')

const dbPath = path.join(__dirname, 'database.db')
const schemaPath = path.join(__dirname, 'schema.sql')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

// const statements = {
//   getAll: db.prepare('SELECT * FROM items'),
//   getById: db.prepare('SELECT * FROM items WHERE id = ?'),
//   Insert: db.prepare('INSERT INTO items (name) values (?)'),
//   update: db.prepare('UPDATE items SET name = ? WHERE id = ?'),
//   delete: db.prepare('DELETE FROM items WHERE id =?')
// }
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
function createThread(text) {
    return db.prepare(`
        INSERT INTO threads (thread_text)
        VALUES (?)
        RETURNING *
    `).get(text);
}

// Create tables/indexes
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

module.exports = {
  db, createThread
}