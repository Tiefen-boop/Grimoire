const express = require('express')
const bcrypt = require('bcryptjs')
const { getDb } = require('../db/database')
const { requireAdmin, requireAuth } = require('../middleware/auth')

const router = express.Router()

// Must be before /:id
router.get('/players', requireAuth, (req, res) => {
  const db = getDb()
  const players = db.prepare(
    "SELECT id, username FROM users WHERE role = 'player' ORDER BY username"
  ).all()
  res.json(players)
})

router.get('/', requireAdmin, (req, res) => {
  const db = getDb()
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY username').all()
  res.json(users)
})

router.post('/', requireAdmin, (req, res) => {
  const { username, password, role = 'player' } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }
  if (!['admin', 'player'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }
  const db = getDb()
  const hash = bcrypt.hashSync(password, 10)
  try {
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    ).run(username, hash, role)
    res.status(201).json({ id: result.lastInsertRowid, username, role })
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already taken' })
    }
    throw err
  }
})

router.put('/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'Password required' })
  const db = getDb()
  const hash = bcrypt.hashSync(password, 10)
  const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' })
  res.json({ success: true })
})

router.delete('/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const result = db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin')
  if (result.changes === 0) return res.status(404).json({ error: 'User not found or cannot delete admin' })
  res.json({ success: true })
})

module.exports = router
