// When 1, max HP is auto-calculated from per-level hit die rolls (classes[].hp_rolls) + CON×level.
// Existing characters start at 0 so their stored max HP stays as a manual value.
module.exports = function up(db) {
  const cols = db.prepare('PRAGMA table_info(characters)').all().map(c => c.name)
  if (!cols.includes('max_hp_auto')) {
    db.exec('ALTER TABLE characters ADD COLUMN max_hp_auto INTEGER NOT NULL DEFAULT 0')
  }
}
