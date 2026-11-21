import { evalFormula } from './formulaEval'

// Effect shape stored on a feature: { target, value, condition, weapon? }
//   target:    'initiative' | 'ac' | 'ac_calc' | 'speed' | 'max_hp'
//              | 'ability:<ability>' | 'passive:<perception|insight|investigation>'
//              | 'weapon_attack' | 'weapon_damage'
//              | 'skill:<Skill name>' | 'skill:*' | 'save:<ability>' | 'save:*'
//   value:     formula string (e.g. '5', 'PROF/2', '2*LVL'), rounded down
//   condition: see EFFECT_CONDITIONS
//   weapon:    weapon filter for weapon_attack/weapon_damage (see WEAPON_FILTERS)

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

export const EFFECT_CONDITIONS = [ALWAYS, ...PROFICIENCY_CONDITIONS, ...ARMOR_CONDITIONS]

// Conditions that make sense for a given target
export function conditionsForTarget(target) {
  if (target?.startsWith('skill:')) return [ALWAYS, ...PROFICIENCY_CONDITIONS, ...ARMOR_CONDITIONS]
  if (target?.startsWith('save:'))  return [ALWAYS, ...PROFICIENCY_CONDITIONS.filter(c => c.value !== 'expertise'), ...ARMOR_CONDITIONS]
  return [ALWAYS, ...ARMOR_CONDITIONS]
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

function conditionMet(condition, { proficient = false, expert = false, armor } = {}) {
  const { body = null, shield = false } = armor || {}
  switch (condition) {
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

// Total bonus applied to `target` by all features, plus where it came from.
// `status` carries proficiency state (skills/saves), equipped armor (armorState) and the weapon (weapon targets).
export function effectBonus(features, char, target, status = {}) {
  let total = 0
  const sources = []
  for (const feat of features || []) {
    for (const eff of feat?.effects || []) {
      if (!eff?.target || !targetMatches(eff.target, target)) continue
      if (!conditionMet(eff.condition, status)) continue
      if (isWeaponTarget(target) && !weaponMatches(eff.weapon, status.weapon)) continue
      const value = effectValue(eff.value, char)
      if (!value && target !== 'ac_calc') continue
      if (value === null) continue
      total += value
      sources.push({ name: feat.name || 'Unnamed feature', value })
    }
  }
  return { total, sources }
}

// Base AC from 'AC calculation' effects (e.g. Unarmored Defense) vs. the normal base; highest wins
export function bestAcBase(features, char, status, normalBase) {
  const { sources } = effectBonus(features, char, 'ac_calc', status)
  const best = sources.reduce((b, s) => (s.value > (b?.value ?? -Infinity) ? s : b), null)
  if (best && best.value > normalBase) return { base: best.value, source: { ...best, base: true } }
  return { base: normalBase, source: null }
}

// Attack/damage effects for one weapon (or { unarmed: true })
export function weaponEffects(features, char, weapon, armor) {
  const status = { weapon, armor }
  return {
    attack: effectBonus(features, char, 'weapon_attack', status),
    damage: effectBonus(features, char, 'weapon_damage', status),
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
  return sources.map(s => s.base ? `${s.name}: base ${s.value}` : `${s.name} ${s.value >= 0 ? '+' : ''}${s.value}`).join('\n')
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
  const armor = armorState(parseMaybeJson(char.equipment) || [])
  const total = effectBonus(features, stats, 'max_hp', { armor }).total
  const applied = (char.exhaustion ?? 0) >= 4 ? Math.floor(total / 2) : total
  return (char.max_hp ?? 0) + applied
}
