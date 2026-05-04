const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

const dbPath = process.env.DB_PATH || './grimoire.db'
const schemaPath = path.join(__dirname, 'schema.sql')
const migrationsDir = path.join(__dirname, 'migrations')

let db

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT NOT NULL PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map(r => r.name)
  )

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const migration = require(path.join(migrationsDir, file))
    migration(db)
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file)
    console.log(`[db] Applied migration: ${file}`)
  }
}

function getDb() {
  if (!db) {
    db = new Database(dbPath)
    db.exec(fs.readFileSync(schemaPath, 'utf8'))
    runMigrations(db)
  }
  return db
}

module.exports = { getDb }
