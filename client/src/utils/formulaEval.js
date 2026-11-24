// Canonical token → accepted spellings (matched case-insensitively)
const TOKEN_ALIASES = {
  STR:  ['str', 'strength'],
  DEX:  ['dex', 'dexterity'],
  CON:  ['con', 'constitution'],
  INT:  ['int', 'intelligence'],
  WIS:  ['wis', 'wisdom'],
  CHA:  ['cha', 'charisma'],
  PROF: ['prof', 'proficiency', 'pb'],
  LVL:  ['lvl', 'level', 'lv', 'class_lvl', 'class_level', 'class_lv'],
}
const ALIAS_TO_TOKEN = Object.fromEntries(
  Object.entries(TOKEN_ALIASES).flatMap(([canon, aliases]) => aliases.map(a => [a, canon]))
)
// Longest first so 'strength' wins over 'str'
const TOKEN_RE = new RegExp(`\\b(${Object.keys(ALIAS_TO_TOKEN).sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi')

// Level in a specific class: '<Class name>_LVL' (any LVL spelling), e.g. Joker_lvl → JOKER_LVL.
// Spaces/punctuation in class names become '_' (Blood Hunter → BLOOD_HUNTER_LVL).
const CLASS_LVL_RE = /\b([a-z][a-z0-9_]*?)_(lvl|lv|level)\b/gi
const classKey = name => String(name || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')

// Rewrite any accepted spelling to its canonical token (e.g. 'strength+prof' → 'STR+PROF').
// Text inside [brackets] (damage types) is left untouched.
export function canonicalizeFormula(formula) {
  if (!formula || typeof formula !== 'string') return formula
  return formula
    .split(/(\[[^\]]*\])/)
    .map(part => part.startsWith('[') ? part : part
      .replace(TOKEN_RE, m => ALIAS_TO_TOKEN[m.toLowerCase()])
      .replace(CLASS_LVL_RE, (_, cls) => `${classKey(cls)}_LVL`))
    .join('')
}

function abilityMod(score) {
  return Math.floor(((score ?? 10) - 10) / 2)
}

// step(x, t1, v1, t2, v2, ...) → value of the highest threshold x has reached, 0 below the first
// e.g. step(MONK_LVL, 2,10, 6,15, 10,20, 14,25, 18,30)
function step(x, ...pairs) {
  let result = 0
  for (let i = 0; i + 1 < pairs.length; i += 2) if (x >= pairs[i]) result = pairs[i + 1]
  return result
}

function safeEval(expr) {
  const withMath = expr
    .replace(/\bmin\b/gi, 'Math.min')
    .replace(/\bmax\b/gi, 'Math.max')
    .replace(/\bfloor\b/gi, 'Math.floor')
    .replace(/\bceil\b/gi, 'Math.ceil')
    .replace(/\bstep\b/gi, 'step')
  const check = withMath.replace(/Math\.(min|max|floor|ceil)|\bstep\b/g, '')
  if (!/^[\d\s+\-*/(),.]*$/.test(check)) throw new Error('unsafe')
  // eslint-disable-next-line no-new-func
  return Function('step', '"use strict"; return (' + withMath + ')')(step)
}

// Evaluate a single formula segment (no [type] annotations, stats already substituted)
function evalSegment(expr) {
  if (!/\d+d\d+/.test(expr)) {
    try {
      const val = safeEval(expr)
      if (typeof val === 'number' && isFinite(val)) return String(val)
    } catch {}
    return expr
  }

  const dice = []
  const nodie = expr.replace(/\d+d\d+/g, m => { dice.push(m); return '0' })
  try {
    const bonus = safeEval(nodie)
    if (typeof bonus === 'number' && isFinite(bonus)) {
      const dicePart = dice.join('+')
      if (bonus > 0) return `${dicePart}+${bonus}`
      if (bonus < 0) return `${dicePart}${bonus}`
      return dicePart
    }
  } catch {}
  return expr
}

export function evalFormula(formula, char) {
  if (!formula || typeof formula !== 'string') return formula ?? ''

  const subs = {
    STR:  abilityMod(char?.strength),
    DEX:  abilityMod(char?.dexterity),
    CON:  abilityMod(char?.constitution),
    INT:  abilityMod(char?.intelligence),
    WIS:  abilityMod(char?.wisdom),
    CHA:  abilityMod(char?.charisma),
    PROF: char?.proficiency_bonus ?? 2,
    LVL:  char?.level ?? ((char?.classes || []).reduce((sum, c) => sum + (parseInt(c.level) || 0), 0) || 1),
  }
  const classLevels = {}
  for (const c of char?.classes || []) {
    const key = classKey(c.name)
    if (key) classLevels[key] = (classLevels[key] || 0) + (parseInt(c.level) || 0)
  }

  // Normalize D→d
  let expr = formula.trim().replace(/D/g, 'd')

  // Substitute stat tokens
  // Class levels default to 0 when the character doesn't have that class
  const substitute = s => s
    .replace(TOKEN_RE, m => subs[ALIAS_TO_TOKEN[m.toLowerCase()]])
    .replace(CLASS_LVL_RE, (_, cls) => classLevels[classKey(cls)] ?? 0)

  // No typed segments — evaluate directly
  if (!expr.includes('[')) return evalSegment(substitute(expr))

  // Split into typed segments: each segment is "formula_part[type]"
  // e.g. "1d8+STR[slashing] + 2d6[fire]"  →  [{f:"1d8+STR", t:"slashing"}, {f:"2d6", t:"fire"}]
  const segments = []
  const re = /([^[\]]+)\[([^\]]+)\]/g
  let lastIndex = 0
  let m

  while ((m = re.exec(expr)) !== null) {
    const part = substitute(m[1].replace(/^[\s+]+/, '').trim())
    if (part) segments.push({ f: part, t: m[2] })
    lastIndex = re.lastIndex
  }

  // Any trailing untyped part after the last [type]
  const tail = substitute(expr.slice(lastIndex).replace(/^[\s+]+/, '').trim())
  if (tail) segments.push({ f: tail, t: null })

  if (segments.length === 0) return evalSegment(substitute(expr))

  return segments
    .map(seg => {
      const result = evalSegment(seg.f)
      return seg.t ? `${result}[${seg.t}]` : result
    })
    .join(' + ')
}
