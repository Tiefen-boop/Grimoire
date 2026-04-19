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
  }
  return db
}

module.exports = { getDb }
