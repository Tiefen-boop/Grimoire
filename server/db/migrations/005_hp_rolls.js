// Classes now record one hit die result per level (classes[].hp_rolls), used by auto max HP.
// Existing characters get 1 for every level that has no recorded result yet, so the player
// fills in the real rolls. Max HP stays manual (max_hp_auto = 0 from migration 004), so the
// current max HP value is unchanged.
module.exports = function up(db) {
  const rows = db.prepare('SELECT id, classes FROM characters').all()
  const update = db.prepare('UPDATE characters SET classes = ? WHERE id = ?')
  for (const row of rows) {
    let classes
    try { classes = JSON.parse(row.classes || '[]') } catch { continue }
    if (!Array.isArray(classes)) continue
    let changed = false
    for (const cls of classes) {
      if (!cls || typeof cls !== 'object') continue
      const level = parseInt(cls.level) || 0
      const rolls = Array.isArray(cls.hp_rolls) ? cls.hp_rolls.slice(0, level) : []
      while (rolls.length < level) rolls.push(1)
      const filled = rolls.map(v => (Number.isFinite(parseInt(v)) ? parseInt(v) : 1))
      if (JSON.stringify(filled) !== JSON.stringify(cls.hp_rolls)) { cls.hp_rolls = filled; changed = true }
    }
    if (changed) update.run(JSON.stringify(classes), row.id)
  }
}
