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

  // Extract bracket annotations (e.g. [slashing]) to re-append later
  const annotations = []
  expr = expr.replace(/\[[^\]]*\]/g, m => { annotations.push(m); return '' })

  // Substitute stat tokens (word-boundary, case-insensitive)
  expr = expr.replace(/\b(str|dex|con|int|wis|cha|prof)\b/gi, m => subs[m.toLowerCase()])

  let result
  if (!/\d+d\d+/.test(expr)) {
    // Pure arithmetic — evaluate fully
    try {
      const val = safeEval(expr)
      if (typeof val === 'number' && isFinite(val)) result = String(val)
    } catch {}
    result = result ?? expr
  } else {
    // Has dice — replace each die with 0, evaluate the arithmetic bonus, then reassemble
    const dice = []
    const nodie = expr.replace(/\d+d\d+/g, m => { dice.push(m); return '0' })
    try {
      const bonus = safeEval(nodie)
      if (typeof bonus === 'number' && isFinite(bonus)) {
        const dicePart = dice.join('+')
        if (bonus > 0) result = `${dicePart}+${bonus}`
        else if (bonus < 0) result = `${dicePart}${bonus}`
        else result = dicePart
      }
    } catch {}
    result = result ?? expr
  }

  return result + annotations.join('')
}
