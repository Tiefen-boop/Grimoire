const express = require('express')
const { getDb } = require('../db/database')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

// List campaigns where user is DM or member
router.get('/', (req, res) => {
  const db = getDb()
  const campaigns = db.prepare(`
    SELECT c.*, u.username AS dm_username,
      CASE WHEN c.dm_id = ? THEN 1 ELSE 0 END AS is_dm
    FROM campaigns c
    JOIN users u ON u.id = c.dm_id
    WHERE c.dm_id = ?
       OR EXISTS (SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = ?)
    ORDER BY c.name
  `).all(req.user.id, req.user.id, req.user.id)
  res.json(campaigns)
})

// Get campaign detail
router.get('/:id', (req, res) => {
  const db = getDb()
  const campaign = db.prepare(`
    SELECT c.*, u.username AS dm_username,
      CASE WHEN c.dm_id = ? THEN 1 ELSE 0 END AS is_dm
    FROM campaigns c JOIN users u ON u.id = c.dm_id
    WHERE c.id = ?
  `).get(req.user.id, req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  const isMember = !!db.prepare(
    'SELECT 1 FROM campaign_members WHERE campaign_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id)

  if (!campaign.is_dm && !isMember) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Members
  campaign.members = db.prepare(`
    SELECT u.id, u.username FROM campaign_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.campaign_id = ?
    ORDER BY u.username
  `).all(req.params.id)

  // Characters: DM sees all, player sees only their own
  let chars
  if (campaign.is_dm) {
    chars = db.prepare(`
      SELECT ch.*, cc.id AS cc_id, cc.added_by, cc.assigned_to, cc.is_copy,
             u.username AS owner_username,
             ab.username AS added_by_username,
             as_.username AS assigned_to_username
      FROM campaign_characters cc
      JOIN characters ch ON ch.id = cc.character_id
      JOIN users u ON u.id = ch.owner_id
      JOIN users ab ON ab.id = cc.added_by
      LEFT JOIN users as_ ON as_.id = cc.assigned_to
      WHERE cc.campaign_id = ?
      ORDER BY ch.name
    `).all(req.params.id)
  } else {
    chars = db.prepare(`
      SELECT ch.*, cc.id AS cc_id, cc.added_by, cc.assigned_to, cc.is_copy
      FROM campaign_characters cc
      JOIN characters ch ON ch.id = cc.character_id
      WHERE cc.campaign_id = ?
        AND (ch.owner_id = ? OR cc.assigned_to = ?)
      ORDER BY ch.name
    `).all(req.params.id, req.user.id, req.user.id)
  }
  campaign.characters = chars

  res.json(campaign)
})

// Create campaign
router.post('/', (req, res) => {
  const { name, description = '' } = req.body
  if (!name) return res.status(400).json({ error: 'Campaign name required' })
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO campaigns (dm_id, name, description) VALUES (?, ?, ?)'
  ).run(req.user.id, name, description)
  res.status(201).json({ id: result.lastInsertRowid, dm_id: req.user.id, name, description })
})

// Update campaign (DM only)
router.put('/:id', (req, res) => {
  const db = getDb()
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Not found' })
  if (campaign.dm_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  const { name, description } = req.body
  db.prepare('UPDATE campaigns SET name = ?, description = ? WHERE id = ?')
    .run(name ?? campaign.name, description ?? campaign.description, req.params.id)
  res.json({ success: true })
})

// Delete campaign (DM only)
router.delete('/:id', (req, res) => {
  const db = getDb()
  const result = db.prepare('DELETE FROM campaigns WHERE id = ? AND dm_id = ?').run(req.params.id, req.user.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Not found or not your campaign' })
  res.json({ success: true })
})

// Add member
router.post('/:id/members', (req, res) => {
  const db = getDb()
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (campaign.dm_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  if (user_id === req.user.id) return res.status(400).json({ error: 'DM cannot add themselves as member' })

  try {
    db.prepare('INSERT INTO campaign_members (campaign_id, user_id) VALUES (?, ?)').run(req.params.id, user_id)
    res.status(201).json({ success: true })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Already a member' })
    throw err
  }
})

// Remove member (DM only)
router.delete('/:id/members/:userId', (req, res) => {
  const db = getDb()
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (campaign.dm_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  db.prepare('DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?')
    .run(req.params.id, req.params.userId)
  res.json({ success: true })
})

// Add character to campaign
router.post('/:id/characters', (req, res) => {
  const db = getDb()
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  const isMember = !!db.prepare(
    'SELECT 1 FROM campaign_members WHERE campaign_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id)
  const isDm = campaign.dm_id === req.user.id

  if (!isDm && !isMember) return res.status(403).json({ error: 'Forbidden' })

  const { character_id } = req.body
  if (!character_id) return res.status(400).json({ error: 'character_id required' })

  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id)
  if (!char) return res.status(404).json({ error: 'Character not found' })
  if (char.owner_id !== req.user.id) return res.status(403).json({ error: 'Not your character' })

  try {
    db.prepare(
      'INSERT INTO campaign_characters (campaign_id, character_id, added_by) VALUES (?, ?, ?)'
    ).run(req.params.id, character_id, req.user.id)
    res.status(201).json({ success: true })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Character already in campaign' })
    throw err
  }
})

// Remove character from campaign (DM or character owner)
router.delete('/:id/characters/:charId', (req, res) => {
  const db = getDb()
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  const cc = db.prepare(
    'SELECT * FROM campaign_characters WHERE campaign_id = ? AND character_id = ?'
  ).get(req.params.id, req.params.charId)
  if (!cc) return res.status(404).json({ error: 'Character not in campaign' })

  const isDm = campaign.dm_id === req.user.id
  const isAdder = cc.added_by === req.user.id

  if (!isDm && !isAdder) return res.status(403).json({ error: 'Forbidden' })

  db.prepare('DELETE FROM campaign_characters WHERE id = ?').run(cc.id)
  res.json({ success: true })
})

// Assign character to player (DM only)
router.put('/:id/characters/:charId/assign', (req, res) => {
  const db = getDb()
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)
  if (!campaign || campaign.dm_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  const cc = db.prepare(
    'SELECT * FROM campaign_characters WHERE campaign_id = ? AND character_id = ?'
  ).get(req.params.id, req.params.charId)
  if (!cc) return res.status(404).json({ error: 'Character not in campaign' })

  const { user_id } = req.body
  db.prepare('UPDATE campaign_characters SET assigned_to = ? WHERE id = ?').run(user_id || null, cc.id)
  res.json({ success: true })
})

// Copy character (DM only — creates a new standalone character owned by DM)
router.post('/:id/characters/:charId/copy', (req, res) => {
  const db = getDb()
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)
  if (!campaign || campaign.dm_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  const original = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.charId)
  if (!original) return res.status(404).json({ error: 'Character not found' })

  // Verify original is in this campaign
  const cc = db.prepare(
    'SELECT 1 FROM campaign_characters WHERE campaign_id = ? AND character_id = ?'
  ).get(req.params.id, req.params.charId)
  if (!cc) return res.status(404).json({ error: 'Character not in campaign' })

  const COPY_FIELDS = [
    'name','class','subclass','level','race','background','alignment','experience_points',
    'strength','dexterity','constitution','intelligence','wisdom','charisma',
    'saving_throw_profs','skill_profs','skill_expertise','proficiency_bonus','inspiration',
    'armor_class','initiative_bonus','speed','max_hp','current_hp','temp_hp',
    'hit_dice','hit_dice_remaining','death_save_successes','death_save_failures',
    'attacks','equipment','copper','silver','electrum','gold','platinum',
    'personality_traits','ideals','bonds','flaws','features_and_traits',
    'spellcasting_ability','spell_save_dc','spell_attack_bonus','spell_slots','spells',
    'other_proficiencies','character_backstory','allies_and_organizations',
    'additional_features_and_traits','treasure',
    'age','height','weight','eyes','skin','hair','appearance_notes',
    'passive_perception','conditions','notes'
  ]

  const fields = COPY_FIELDS.filter(f => original[f] !== undefined)
  const placeholders = fields.map(() => '?').join(', ')
  const values = fields.map(f => original[f])

  const result = db.prepare(
    `INSERT INTO characters (owner_id, ${fields.join(', ')}) VALUES (?, ${placeholders})`
  ).run(req.user.id, ...values)

  // Add copy to the same campaign
  db.prepare(
    'INSERT INTO campaign_characters (campaign_id, character_id, added_by, is_copy) VALUES (?, ?, ?, 1)'
  ).run(req.params.id, result.lastInsertRowid, req.user.id)

  res.status(201).json({ id: result.lastInsertRowid, success: true })
})

module.exports = router
