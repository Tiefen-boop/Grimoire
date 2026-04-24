const express = require('express')
const { getDb } = require('../db/database')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

const CHARACTER_FIELDS = [
  'name','class','subclass','level','race','background','alignment','experience_points',
  'classes',
  'strength','dexterity','constitution','intelligence','wisdom','charisma',
  'saving_throw_profs','skill_profs','skill_expertise',
  'proficiency_bonus','inspiration',
  'armor_class','initiative_bonus','speed','max_hp','current_hp','temp_hp',
  'hit_dice','hit_dice_remaining','death_save_successes','death_save_failures',
  'attacks','equipment','copper','silver','electrum','gold','platinum',
  'personality_traits','ideals','bonds','flaws','features_and_traits',
  'spellcasting_ability','spell_save_dc','spell_attack_bonus','spell_slots','spells',
  'other_proficiencies','character_backstory','allies_and_organizations',
  'additional_features_and_traits','treasure',
  'age','height','weight','eyes','skin','hair','appearance_notes',
  'passive_perception','conditions','notes','features_list','exhaustion','speed_base','max_hp_base',
  'unarmed_attack_modifier','unarmed_damage_roll',
  'weapon_profs','armor_profs','tool_profs','languages',
  'portrait'
]

const JSON_FIELDS = new Set([
  'saving_throw_profs','skill_profs','skill_expertise','attacks','equipment',
  'spell_slots','spells','conditions','features_list','classes',
  'weapon_profs','armor_profs','tool_profs','languages'
])

function parseJsonFields(char) {
  if (!char) return char
  for (const f of JSON_FIELDS) {
    if (typeof char[f] === 'string') {
      try { char[f] = JSON.parse(char[f]) } catch { char[f] = f === 'spell_slots' ? {} : [] }
    }
  }
  return char
}

function stringifyJsonFields(data) {
  const out = { ...data }
  for (const f of JSON_FIELDS) {
    if (f in out && typeof out[f] !== 'string') {
      out[f] = JSON.stringify(out[f])
    }
  }
  return out
}

// Admin-only: list all characters across all users
router.get('/all', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
  const db = getDb()
  const chars = db.prepare(`
    SELECT c.id, c.owner_id, c.name, c.class, c.level, c.race, c.current_hp, c.max_hp, c.updated_at,
           u.username AS owner_username
    FROM characters c
    JOIN users u ON u.id = c.owner_id
    ORDER BY u.username, c.name
  `).all()
  res.json(chars)
})

// List own characters (players only — admin has no characters)
router.get('/', (req, res) => {
  if (req.user.role === 'admin') return res.json([])
  const db = getDb()
  const chars = db.prepare(
    'SELECT id, owner_id, name, class, level, race, current_hp, max_hp, portrait, updated_at FROM characters WHERE owner_id = ? ORDER BY name'
  ).all(req.user.id)
  res.json(chars)
})

// Get single character (owner or DM of a campaign it belongs to; admin read-only)
router.get('/:id', (req, res) => {
  const db = getDb()
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id)
  if (!char) return res.status(404).json({ error: 'Character not found' })

  const isAdmin = req.user.role === 'admin'
  const isOwner = char.owner_id === req.user.id
  const isDmOfCampaign = !!db.prepare(`
    SELECT 1 FROM campaign_characters cc
    JOIN campaigns c ON c.id = cc.campaign_id
    WHERE cc.character_id = ? AND c.dm_id = ?
  `).get(req.params.id, req.user.id)

  if (!isAdmin && !isOwner && !isDmOfCampaign) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const parsed = parseJsonFields(char)
  parsed.can_edit = isOwner || isDmOfCampaign
  res.json(parsed)
})

// Create character (players only)
router.post('/', (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot own characters' })
  }
  const db = getDb()
  const data = stringifyJsonFields(req.body)
  const fields = CHARACTER_FIELDS.filter(f => f in data)
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields provided' })
  }
  const placeholders = fields.map(() => '?').join(', ')
  const values = fields.map(f => data[f])

  const result = db.prepare(
    `INSERT INTO characters (owner_id, ${fields.join(', ')}) VALUES (?, ${placeholders})`
  ).run(req.user.id, ...values)

  const created = db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(parseJsonFields(created))
})

// Update character (owner or campaign DM; admin cannot edit)
router.put('/:id', (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot edit characters' })
  }
  const db = getDb()
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id)
  if (!char) return res.status(404).json({ error: 'Character not found' })

  const isOwner = char.owner_id === req.user.id
  const isDmOfCampaign = !!db.prepare(`
    SELECT 1 FROM campaign_characters cc
    JOIN campaigns c ON c.id = cc.campaign_id
    WHERE cc.character_id = ? AND c.dm_id = ?
  `).get(req.params.id, req.user.id)

  if (!isOwner && !isDmOfCampaign) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const data = stringifyJsonFields(req.body)
  const fields = CHARACTER_FIELDS.filter(f => f in data)
  if (fields.length === 0) return res.status(400).json({ error: 'No fields provided' })

  const setClause = fields.map(f => `${f} = ?`).join(', ')
  const values = fields.map(f => data[f])

  db.prepare(`UPDATE characters SET ${setClause} WHERE id = ?`).run(...values, req.params.id)

  const updated = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id)
  res.json(parseJsonFields(updated))
})

// Duplicate character (owner only)
router.post('/:id/copy', (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot own characters' })
  }
  const db = getDb()
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id)
  if (!char) return res.status(404).json({ error: 'Character not found or not yours' })

  const data = { ...char }
  delete data.id
  delete data.owner_id
  delete data.created_at
  delete data.updated_at
  data.name = `Copy of ${data.name || 'Unnamed'}`

  const fields = CHARACTER_FIELDS.filter(f => f in data)
  const placeholders = fields.map(() => '?').join(', ')
  const values = fields.map(f => data[f])

  const result = db.prepare(
    `INSERT INTO characters (owner_id, ${fields.join(', ')}) VALUES (?, ${placeholders})`
  ).run(req.user.id, ...values)

  const created = db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(parseJsonFields(created))
})

// Delete character (owner only; admin cannot delete)
router.delete('/:id', (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot delete characters' })
  }
  const db = getDb()
  const result = db.prepare('DELETE FROM characters WHERE id = ? AND owner_id = ?').run(req.params.id, req.user.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Character not found or not yours' })
  res.json({ success: true })
})

module.exports = router
