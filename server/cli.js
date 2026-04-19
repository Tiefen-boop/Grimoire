#!/usr/bin/env node
require('dotenv').config()
const { Command } = require('commander')
const bcrypt = require('bcryptjs')
const { getDb } = require('./db/database')

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

program.parse()
