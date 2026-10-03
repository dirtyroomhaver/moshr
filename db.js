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



// Create tables/indexes
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

db.prepare(`
  INSERT OR IGNORE INTO moshpits (title)
  VALUES (?)
`).run('moshpit')

db.prepare(`
  INSERT OR IGNORE INTO moshpits (title, flags)
  VALUES (?,?)
`).run('global', 1)

db
    .prepare(
      `
        INSERT OR IGNORE INTO users (session_id, code, pin_hash, is_owner)
        VALUES (?, ?, ?, ?)
    `
    )
    .run('1', 'dirtyroom', `$2b$10$vhlD/vT8YlFpt9zR3xkAV.6U7fO9tyOppGTkcUGsXHgPvN0ZwIzte`, '1')

db.prepare(
  `INSERT OR IGNORE INTO site_settings (max_threads) VALUES (?)`
).run(150)
module.exports = {
    db
}