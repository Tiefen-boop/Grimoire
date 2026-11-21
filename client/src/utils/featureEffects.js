import { evalFormula } from './formulaEval'

// Effect shape stored on a feature or an inventory item: { target, value, condition, weapon? }
//   target:    'initiative' | 'ac' | 'ac_calc' | 'speed' | 'max_hp'
//              | 'ability:<ability>' | 'passive:<perception|insight|investigation>'
//              | 'weapon_attack' | 'weapon_damage'
//              | 'skill:<Skill name>' | 'skill:*' | 'save:<ability>' | 'save:*'
//   value:     formula string (e.g. '5', 'PROF/2', '2*LVL'), rounded down
//   condition: see EFFECT_CONDITIONS
//   weapon:    weapon filter for weapon_attack/weapon_damage (see WEAPON_FILTERS)
//   mode:      'add' (default) or 'min' — "set to at least" (e.g. Gauntlets of Ogre Power: STR at least 19)

const ALWAYS = { value: 'always', label: 'Always' }

const PROFICIENCY_CONDITIONS = [
  { value: 'not_proficient', label: 'If not proficient' },
  { value: 'proficient',     label: 'If proficient' },
  { value: 'expertise',      label: 'If expertise' },
]

const ARMOR_CONDITIONS = [
  { value: 'no_armor',           label: 'If not wearing armor' },
  { value: 'no_armor_no_shield', label: 'If no armor and no shield' },
  { value: 'no_heavy_armor',     label: 'If not wearing heavy armor' },
  { value: 'wearing_armor',      label: 'If wearing armor' },
]

// Items only
const ATTUNED = { value: 'attuned', label: 'If attuned' }

export const EFFECT_CONDITIONS = [ALWAYS, ATTUNED, ...PROFICIENCY_CONDITIONS, ...ARMOR_CONDITIONS]

// Conditions that make sense for a given target (and whether the effect is on an item)
export function conditionsForTarget(target, { item = false } = {}) {
  const base = item ? [ALWAYS, ATTUNED] : [ALWAYS]
  if (target?.startsWith('skill:')) return [...base, ...PROFICIENCY_CONDITIONS, ...ARMOR_CONDITIONS]
  if (target?.startsWith('save:'))  return [...base, ...PROFICIENCY_CONDITIONS.filter(c => c.value !== 'expertise'), ...ARMOR_CONDITIONS]
  return [...base, ...ARMOR_CONDITIONS]
}

// Everything that can carry effects: features, then inventory items
export function effectSources(features, equipment) {
  return [...(features || []), ...(equipment || []).filter(i => i?.effects?.length)]
}

export const WEAPON_FILTERS = [
  { value: 'all',              label: 'All weapons' },
  { value: 'melee',            label: 'Melee weapons' },
  { value: 'ranged',           label: 'Ranged weapons' },
  { value: 'simple',           label: 'Simple weapons' },
  { value: 'martial',          label: 'Martial weapons' },
  { value: 'melee_one_handed', label: 'One-handed melee weapons' },
  { value: 'unarmed',          label: 'Unarmed strike' },
]

export const isWeaponTarget = target => target === 'weapon_attack' || target === 'weapon_damage'

// Targets where "set to at least" makes sense (not weapons, AC calculation, speed or max HP)
export const supportsMinMode = target =>
  target === 'initiative' || target === 'ac' ||
  /^(ability|passive|skill|save):/.test(target || '')

export function weaponFilterLabel(filter) {
  if (filter?.startsWith('specific:')) return filter.slice(9)
  return (WEAPON_FILTERS.find(f => f.value === (filter || 'all')) || WEAPON_FILTERS[0]).label
}

// `weapon` is an equipment item, or { unarmed: true } for the unarmed strike
function weaponMatches(filter = 'all', weapon) {
  if (!weapon) return false
  if (filter === 'unarmed') return !!weapon.unarmed
  if (weapon.unarmed) return false
  const range = weapon.weapon_range || 'melee'
  const props = (weapon.properties || []).map(p => p.name)
  switch (filter) {
    case 'all':              return true
    case 'melee':            return range === 'melee'
    case 'ranged':           return range === 'ranged'
    case 'simple':           return (weapon.weapon_class || 'simple') === 'simple'
    case 'martial':          return weapon.weapon_class === 'martial'
    case 'melee_one_handed': return range === 'melee' && !props.includes('Two-Handed') && !weapon.versatile_active
    default:
      if (filter.startsWith('specific:')) return weapon.weapon_specific === filter.slice(9)
      return false
  }
}

// What armor is currently equipped: { body: 'light'|'medium'|'heavy'|null, shield: bool }
export function armorState(equipment) {
  const equipped = (equipment || []).filter(i => i?.type === 'armor' && i.equipped)
  const body = equipped.find(i => i.armor_category !== 'shield')
  return { body: body ? (body.armor_category || 'light') : null, shield: equipped.some(i => i.armor_category === 'shield') }
}

function targetMatches(effectTarget, target) {
  if (effectTarget === target) return true
  if (effectTarget === 'skill:*') return target.startsWith('skill:')
  if (effectTarget === 'save:*')  return target.startsWith('save:')
  return false
}

function conditionMet(condition, { proficient = false, expert = false, armor } = {}, source) {
  const { body = null, shield = false } = armor || {}
  switch (condition) {
    case 'attuned':            return !!source?.attuned
    case 'not_proficient':     return !proficient && !expert
    case 'proficient':         return proficient || expert
    case 'expertise':          return expert
    case 'no_armor':           return !body
    case 'no_armor_no_shield': return !body && !shield
    case 'no_heavy_armor':     return body !== 'heavy'
    case 'wearing_armor':      return !!body
    default:                   return true
  }
}

// Numeric value of an effect formula, rounded down; null if it isn't a number
export function effectValue(formula, char) {
  if (formula === null || formula === undefined || String(formula).trim() === '') return null
  const n = Number(evalFormula(String(formula), char))
  return Number.isFinite(n) ? Math.floor(n) : null
}

// Total bonus applied to `target` by all sources (features and items — see effectSources), plus where it came from.
// `status` carries proficiency state (skills/saves), equipped armor (armorState) and the weapon (weapon targets).
export function effectBonus(effectSourceList, char, target, status = {}) {
  let total = 0
  const sources = []
  let min = null  // highest "set to at least" floor: { name, value }
  for (const feat of effectSourceList || []) {
    for (const eff of feat?.effects || []) {
      if (!eff?.target || !targetMatches(eff.target, target)) continue
      if (!conditionMet(eff.condition, status, feat)) continue
      if (isWeaponTarget(target) && !weaponMatches(eff.weapon, status.weapon)) continue
      const value = effectValue(eff.value, char)
      if (value === null) continue
      if (eff.mode === 'min' && supportsMinMode(target)) {
        if (!min || value > min.value) min = { name: feat.name || 'Unnamed', value }
        continue
      }
      if (!value && target !== 'ac_calc') continue
      total += value
      sources.push({ name: feat.name || 'Unnamed', value })
    }
  }
  return { total, sources, min }
}

// Final value = base + bonuses, raised to the highest "set to at least" floor if that's higher.
// When a floor wins, it is the only source shown (the bonuses no longer matter).
export function applyEffects(base, fx) {
  const added = base + fx.total
  if (fx.min && fx.min.value > added) return { value: fx.min.value, sources: [{ ...fx.min, min: true }] }
  return { value: added, sources: fx.sources }
}

// Base AC from 'AC calculation' effects (e.g. Unarmored Defense) vs. the normal base; highest wins
export function bestAcBase(effectSourceList, char, status, normalBase) {
  const { sources } = effectBonus(effectSourceList, char, 'ac_calc', status)
  const best = sources.reduce((b, s) => (s.value > (b?.value ?? -Infinity) ? s : b), null)
  if (best && best.value > normalBase) return { base: best.value, source: { ...best, base: true } }
  return { base: normalBase, source: null }
}

// Attack/damage effects for one weapon (or { unarmed: true })
export function weaponEffects(effectSourceList, char, weapon, armor) {
  const status = { weapon, armor }
  return {
    attack: effectBonus(effectSourceList, char, 'weapon_attack', status),
    damage: effectBonus(effectSourceList, char, 'weapon_damage', status),
  }
}

// Add a flat bonus to a formula; for typed damage ('1d8+STR[slashing] + 2d6[fire]') it joins the first segment
export function addBonusToFormula(formula, bonus) {
  if (!bonus || !formula) return formula
  const s = bonus > 0 ? `+${bonus}` : `${bonus}`
  const idx = formula.indexOf('[')
  return idx < 0 ? `${formula}${s}` : `${formula.slice(0, idx)}${s}${formula.slice(idx)}`
}

export function sourcesTitle(sources) {
  return sources.map(s =>
    s.base ? `${s.name}: base ${s.value}`
    : s.min ? `${s.name}: at least ${s.value}`
    : `${s.name} ${s.value >= 0 ? '+' : ''}${s.value}`).join('\n')
}

// List endpoints may return JSON columns as raw strings
function parseMaybeJson(v) {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return null }
}

// Max HP including feature effects, for views that only have the raw character row
export function effectiveMaxHp(char) {
  const features = parseMaybeJson(char.features_list) || []
  const classes  = parseMaybeJson(char.classes) || []
  const stats = {
    strength: char.strength, dexterity: char.dexterity, constitution: char.constitution,
    intelligence: char.intelligence, wisdom: char.wisdom, charisma: char.charisma,
    proficiency_bonus: char.proficiency_bonus,
    classes,
  }
  const equipment = parseMaybeJson(char.equipment) || []
  const armor = armorState(equipment)
  const total = effectBonus(effectSources(features, equipment), stats, 'max_hp', { armor }).total
  const applied = (char.exhaustion ?? 0) >= 4 ? Math.floor(total / 2) : total
  return (char.max_hp ?? 0) + applied
}
