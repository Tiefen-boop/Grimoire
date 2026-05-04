#!/usr/bin/env node
require('dotenv').config()
const { Command } = require('commander')
const bcrypt = require('bcryptjs')
const { getDb } = require('./db/database')
const zlib     = require('zlib')
const fs       = require('fs')
const path     = require('path')
const readline = require('readline')

const TABLE_ORDER = ['users', 'characters', 'campaigns', 'campaign_members', 'campaign_characters']

const program = new Command()

program
  .name('grimoire-admin')
  .description('Grimoire server administration CLI')

program
  .command('create-admin')
  .description('Create an admin user')
  .requiredOption('-u, --username <username>', 'Admin username')
  .requiredOption('-p, --password <password>', 'Admin password')
  .action(({ username, password }) => {
    const db = getDb()
    const hash = bcrypt.hashSync(password, 10)
    try {
      const result = db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')"
      ).run(username, hash)
      console.log(`Admin user "${username}" created with id ${result.lastInsertRowid}`)
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        console.error(`Error: Username "${username}" is already taken`)
        process.exit(1)
      }
      throw err
    }
  })

program
  .command('list-users')
  .description('List all users')
  .action(() => {
    const db = getDb()
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all()
    if (users.length === 0) {
      console.log('No users found.')
      return
    }
    users.forEach(u => console.log(`[${u.id}] ${u.username} (${u.role}) — created ${u.created_at}`))
  })

program
  .command('reset-password')
  .description('Reset a user password')
  .requiredOption('-u, --username <username>', 'Username')
  .requiredOption('-p, --password <password>', 'New password')
  .action(({ username, password }) => {
    const db = getDb()
    const hash = bcrypt.hashSync(password, 10)
    const result = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username)
    if (result.changes === 0) {
      console.error(`User "${username}" not found`)
      process.exit(1)
    }
    console.log(`Password reset for "${username}"`)
  })

program
  .command('backup')
  .description('Create a compressed backup of all data')
  .option('-o, --output <path>', 'Output file path (default: project root with timestamp)')
  .action((opts) => {
    const db = getDb()
    const tables = {}
    for (const name of TABLE_ORDER) {
      tables[name] = db.prepare(`SELECT * FROM ${name}`).all()
    }
    const backup = { version: 1, created_at: new Date().toISOString(), tables }
    const json = JSON.stringify(backup)
    const compressed = zlib.gzipSync(Buffer.from(json))
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')
    const outPath = opts.output || path.join(__dirname, '..', `grimoire-backup-${timestamp}.json.gz`)
    fs.writeFileSync(outPath, compressed)
    const sizeMB = (compressed.length / 1024 / 1024).toFixed(2)
    console.log(`Backup written to: ${outPath} (${sizeMB} MB)`)
    for (const name of TABLE_ORDER) {
      console.log(`  ${name}: ${tables[name].length} rows`)
    }
    process.exit(0)
  })

program
  .command('restore')
  .description('Restore all data from a backup file')
  .requiredOption('-f, --file <path>', 'Path to backup file (.json.gz)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (opts) => {
    let backup
    try {
      const raw = zlib.gunzipSync(fs.readFileSync(opts.file))
      backup = JSON.parse(raw.toString())
    } catch {
      console.error('Error: File is not a valid Grimoire backup.')
      process.exit(1)
    }

    if (backup.version !== 1 || !backup.tables || TABLE_ORDER.some(t => !Array.isArray(backup.tables[t]))) {
      console.error('Error: Backup file has an invalid format or unsupported version.')
      process.exit(1)
    }

    console.log(`Backup created: ${backup.created_at}`)
    for (const name of TABLE_ORDER) {
      console.log(`  ${name}: ${backup.tables[name].length} rows`)
    }

    if (!opts.yes) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise(resolve => {
        rl.question('\nWARNING: This will DELETE ALL EXISTING DATA and replace it with the backup contents.\nType "yes" to continue: ', resolve)
      })
      rl.close()
      if (answer.trim() !== 'yes') {
        console.log('Aborted.')
        process.exit(0)
      }
    }

    const db = getDb()
    db.pragma('foreign_keys = OFF')
    db.transaction(() => {
      for (const name of [...TABLE_ORDER].reverse()) {
        db.prepare(`DELETE FROM ${name}`).run()
      }
      for (const name of TABLE_ORDER) {
        const rows = backup.tables[name]
        if (rows.length === 0) continue
        const cols = Object.keys(rows[0])
        const placeholders = cols.map(() => '?').join(', ')
        const stmt = db.prepare(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${placeholders})`)
        for (const row of rows) stmt.run(...Object.values(row))
      }
    })()
    db.pragma('foreign_keys = ON')

    for (const name of TABLE_ORDER) {
      db.prepare(`UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM ${name}) WHERE name = ?`).run(name)
    }

    console.log('\nRestore complete:')
    for (const name of TABLE_ORDER) {
      console.log(`  ${name}: ${backup.tables[name].length} rows restored`)
    }
    process.exit(0)
  })

program.parse()
