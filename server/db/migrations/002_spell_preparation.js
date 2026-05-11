module.exports = function up(db) {
  const rows = db.prepare('SELECT id, classes FROM characters').all()
  const update = db.prepare('UPDATE characters SET classes = ? WHERE id = ?')

  for (const row of rows) {
    let classes
    try { classes = JSON.parse(row.classes) } catch { continue }
    if (!Array.isArray(classes)) continue

    let changed = false
    for (const cls of classes) {
      if (cls.is_spellcaster && cls.spell_preparation == null) {
        cls.spell_preparation = 'prepared'
        changed = true
      }
    }
    if (changed) update.run(JSON.stringify(classes), row.id)
  }
}
