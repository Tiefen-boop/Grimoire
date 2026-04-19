const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

const dbPath = process.env.DB_PATH || './grimoire.db'
const schemaPath = path.join(__dirname, 'schema.sql')

let db

function getDb() {
  if (!db) {
    db = new Database(dbPath)
    const schema = fs.readFileSync(schemaPath, 'utf8')
    db.exec(schema)
    // Migrations: add columns that may not exist on older databases
    const migrations = [
      "ALTER TABLE characters ADD COLUMN features_list TEXT NOT NULL DEFAULT '[]'",
    ]
    for (const sql of migrations) {
      try { db.exec(sql) } catch { /* column already exists */ }
    }
  }
  return db
}

module.exports = { getDb }
