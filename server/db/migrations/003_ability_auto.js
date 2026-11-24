// Abilities listed here are auto-calculated from feature effects (like AC/initiative when not manual).
// Existing characters start with [] so their stored scores stay as manual values.
module.exports = function up(db) {
  const cols = db.prepare('PRAGMA table_info(characters)').all().map(c => c.name)
  if (!cols.includes('ability_auto')) {
    db.exec("ALTER TABLE characters ADD COLUMN ability_auto TEXT NOT NULL DEFAULT '[]'")
  }
}
