PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('admin', 'player')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic Info
  name TEXT NOT NULL DEFAULT '',
  class TEXT NOT NULL DEFAULT '',
  subclass TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  classes TEXT NOT NULL DEFAULT '[]',
  race TEXT NOT NULL DEFAULT '',
  background TEXT NOT NULL DEFAULT '',
  alignment TEXT NOT NULL DEFAULT '',
  experience_points INTEGER NOT NULL DEFAULT 0,

  -- Ability Scores
  strength INTEGER NOT NULL DEFAULT 10,
  dexterity INTEGER NOT NULL DEFAULT 10,
  constitution INTEGER NOT NULL DEFAULT 10,
  intelligence INTEGER NOT NULL DEFAULT 10,
  wisdom INTEGER NOT NULL DEFAULT 10,
  charisma INTEGER NOT NULL DEFAULT 10,

  -- Saving throw proficiencies (JSON array of ability names)
  saving_throw_profs TEXT NOT NULL DEFAULT '[]',

  -- Skill proficiencies (JSON array of skill names)
  skill_profs TEXT NOT NULL DEFAULT '[]',
  -- Expertise (double proficiency)
  skill_expertise TEXT NOT NULL DEFAULT '[]',

  -- Proficiency & Inspiration
  proficiency_bonus INTEGER NOT NULL DEFAULT 2,
  inspiration INTEGER NOT NULL DEFAULT 0,

  -- Combat
  armor_class INTEGER NOT NULL DEFAULT 10,
  initiative_bonus INTEGER NOT NULL DEFAULT 0,
  speed INTEGER NOT NULL DEFAULT 30,
  max_hp INTEGER NOT NULL DEFAULT 0,
  current_hp INTEGER NOT NULL DEFAULT 0,
  temp_hp INTEGER NOT NULL DEFAULT 0,
  hit_dice TEXT NOT NULL DEFAULT '',
  hit_dice_remaining TEXT NOT NULL DEFAULT '',
  death_save_successes INTEGER NOT NULL DEFAULT 0,
  death_save_failures INTEGER NOT NULL DEFAULT 0,

  -- Attacks (JSON array of {name, attack_bonus, damage, damage_type, range, notes})
  attacks TEXT NOT NULL DEFAULT '[]',

  -- Equipment
  equipment TEXT NOT NULL DEFAULT '[]',
  copper INTEGER NOT NULL DEFAULT 0,
  silver INTEGER NOT NULL DEFAULT 0,
  electrum INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 0,
  platinum INTEGER NOT NULL DEFAULT 0,

  -- Features & Traits
  personality_traits TEXT NOT NULL DEFAULT '',
  ideals TEXT NOT NULL DEFAULT '',
  bonds TEXT NOT NULL DEFAULT '',
  flaws TEXT NOT NULL DEFAULT '',
  features_and_traits TEXT NOT NULL DEFAULT '',

  -- Spellcasting
  spellcasting_ability TEXT NOT NULL DEFAULT '',
  spell_save_dc INTEGER NOT NULL DEFAULT 0,
  spell_attack_bonus INTEGER NOT NULL DEFAULT 0,
  -- spell_slots: JSON object {1:{total,used}, 2:{total,used}, ...}
  spell_slots TEXT NOT NULL DEFAULT '{}',
  -- spells: JSON array of {level, name, prepared, school, cast_time, range, components, duration, description}
  spells TEXT NOT NULL DEFAULT '[]',

  -- Proficiencies & Languages
  other_proficiencies TEXT NOT NULL DEFAULT '',

  -- Backstory
  character_backstory TEXT NOT NULL DEFAULT '',
  allies_and_organizations TEXT NOT NULL DEFAULT '',
  additional_features_and_traits TEXT NOT NULL DEFAULT '',
  treasure TEXT NOT NULL DEFAULT '',

  -- Appearance
  age TEXT NOT NULL DEFAULT '',
  height TEXT NOT NULL DEFAULT '',
  weight TEXT NOT NULL DEFAULT '',
  eyes TEXT NOT NULL DEFAULT '',
  skin TEXT NOT NULL DEFAULT '',
  hair TEXT NOT NULL DEFAULT '',
  appearance_notes TEXT NOT NULL DEFAULT '',

  -- Passive Perception (stored for quick access)
  passive_perception INTEGER NOT NULL DEFAULT 10,

  -- Conditions (JSON array)
  conditions TEXT NOT NULL DEFAULT '[]',

  -- Exhaustion level (0–6)
  exhaustion INTEGER NOT NULL DEFAULT 0,

  -- Base values saved before condition effects are applied (NULL = no effect active)
  speed_base INTEGER,
  max_hp_base INTEGER,

  -- Features list (JSON array of {name, description})
  features_list TEXT NOT NULL DEFAULT '[]',

  -- Unarmed strike overrides
  unarmed_attack_modifier TEXT NOT NULL DEFAULT '',
  unarmed_damage_roll TEXT NOT NULL DEFAULT '',

  -- Proficiencies (JSON arrays)
  weapon_profs TEXT NOT NULL DEFAULT '[]',
  armor_profs TEXT NOT NULL DEFAULT '[]',
  tool_profs TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '[]',

  -- Portrait (base64 data URL)
  portrait TEXT NOT NULL DEFAULT '',

  -- Notes
  notes TEXT NOT NULL DEFAULT '',

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dm_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Players added to a campaign (dm is not in this table, they own it)
CREATE TABLE IF NOT EXISTS campaign_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, user_id)
);

-- Characters linked to a campaign
-- A character can be in multiple campaigns
-- assigned_to: if DM reassigns ownership within the campaign context, or NULL = original owner
CREATE TABLE IF NOT EXISTS campaign_characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  -- user who added this character to the campaign
  added_by INTEGER NOT NULL REFERENCES users(id),
  -- overridden owner within campaign scope (DM reassignment); NULL = use character.owner_id
  assigned_to INTEGER REFERENCES users(id),
  is_copy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, character_id)
);

CREATE TRIGGER IF NOT EXISTS characters_updated_at
  AFTER UPDATE ON characters
  BEGIN
    UPDATE characters SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
