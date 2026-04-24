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
      "ALTER TABLE characters ADD COLUMN unarmed_attack_modifier TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE characters ADD COLUMN unarmed_damage_roll TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE characters ADD COLUMN weapon_profs TEXT NOT NULL DEFAULT '[]'",
      "ALTER TABLE characters ADD COLUMN armor_profs TEXT NOT NULL DEFAULT '[]'",
      "ALTER TABLE characters ADD COLUMN tool_profs TEXT NOT NULL DEFAULT '[]'",
      "ALTER TABLE characters ADD COLUMN languages TEXT NOT NULL DEFAULT '[]'",
      "ALTER TABLE characters ADD COLUMN portrait TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE characters ADD COLUMN armor_class_manual INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE characters ADD COLUMN initiative_manual INTEGER NOT NULL DEFAULT 0",
    ]
    for (const sql of migrations) {
      try { db.exec(sql) } catch { /* column already exists */ }
    }
  }
  return db
}

module.exports = { getDb }
