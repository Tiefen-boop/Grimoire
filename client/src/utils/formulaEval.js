function abilityMod(score) {
  return Math.floor(((score ?? 10) - 10) / 2)
}

function safeEval(expr) {
  const withMath = expr
    .replace(/\bmin\b/gi, 'Math.min')
    .replace(/\bmax\b/gi, 'Math.max')
  const check = withMath.replace(/Math\.(min|max)/g, '')
  if (!/^[\d\s+\-*/(),.]*$/.test(check)) throw new Error('unsafe')
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + withMath + ')')()
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
    str:  abilityMod(char?.strength),
    dex:  abilityMod(char?.dexterity),
    con:  abilityMod(char?.constitution),
    int:  abilityMod(char?.intelligence),
    wis:  abilityMod(char?.wisdom),
    cha:  abilityMod(char?.charisma),
    prof: char?.proficiency_bonus ?? 2,
  }

  // Normalize D→d
  let expr = formula.trim().replace(/D/g, 'd')

  // Substitute stat tokens
  const substitute = s => s.replace(/\b(str|dex|con|int|wis|cha|prof)\b/gi, m => subs[m.toLowerCase()])

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
