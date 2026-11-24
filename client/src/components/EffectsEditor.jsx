import { useState } from 'react'
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { canonicalizeFormula } from '../utils/formulaEval'
import { effectValue, conditionsForTarget, isWeaponTarget, supportsMinMode, WEAPON_FILTERS, weaponFilterLabel } from '../utils/featureEffects'

// Editor + in-app documentation for effects on features and items

const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const ABILITY_SHORT = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' }
const SKILL_NAMES = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation',
  'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival',
]
const SPECIFIC_WEAPONS = [
  'Club', 'Dagger', 'Greatclub', 'Handaxe', 'Javelin', 'Light Hammer', 'Mace', 'Quarterstaff', 'Sickle', 'Spear',
  'Light Crossbow', 'Dart', 'Shortbow', 'Sling',
  'Battleaxe', 'Flail', 'Glaive', 'Greataxe', 'Greatsword', 'Halberd', 'Lance', 'Longsword', 'Maul', 'Morningstar', 'Pike',
  'Rapier', 'Scimitar', 'Shortsword', 'Trident', 'War Pick', 'Warhammer', 'Whip',
  'Blowgun', 'Hand Crossbow', 'Heavy Crossbow', 'Longbow', 'Net',
].sort()

function fmtMod(n) {
  return n >= 0 ? `+${n}` : `${n}`
}

const EFFECT_TARGET_GROUPS = [
  { label: 'General', options: [
    { value: 'initiative', label: 'Initiative' },
    { value: 'ac',         label: 'AC (bonus)' },
    { value: 'ac_calc',    label: 'AC calculation (base)' },
    { value: 'speed',      label: 'Speed' },
    { value: 'max_hp',     label: 'Max HP' },
  ]},
  { label: 'Ability scores', options: ABILITIES.map(a => ({ value: `ability:${a}`, label: `${ABILITY_SHORT[a]} score` })) },
  { label: 'Passive scores', options: [
    { value: 'passive:perception',    label: 'Passive Perception' },
    { value: 'passive:insight',       label: 'Passive Insight' },
    { value: 'passive:investigation', label: 'Passive Investigation' },
  ]},
  { label: 'Weapons', options: [
    { value: 'weapon_attack', label: 'Weapon attack' },
    { value: 'weapon_damage', label: 'Weapon damage' },
  ]},
  { label: 'Skills', options: [
    { value: 'skill:*', label: 'All skills' },
    ...SKILL_NAMES.map(name => ({ value: `skill:${name}`, label: name })),
  ]},
  { label: 'Saving throws', options: [
    { value: 'save:*', label: 'All saves' },
    ...ABILITIES.map(a => ({ value: `save:${a}`, label: `${ABILITY_SHORT[a]} save` })),
  ]},
]

function effectTargetLabel(target) {
  for (const g of EFFECT_TARGET_GROUPS) {
    const opt = g.options.find(o => o.value === target)
    if (opt) return opt.label
  }
  return target || '—'
}

export function effectSummary(eff, { item = false } = {}) {
  const cond = conditionsForTarget(eff.target, { item }).find(c => c.value === eff.condition)
  const value = String(eff.value ?? '').trim()
  const isMin = eff.mode === 'min' && supportsMinMode(eff.target)
  const amount = eff.target === 'ac_calc' ? `= ${value}` : isMin ? `at least ${value}` : /^[+\-]/.test(value) ? value : `+${value}`
  const weapon = isWeaponTarget(eff.target) ? ` (${weaponFilterLabel(eff.weapon).toLowerCase()})` : ''
  return `${effectTargetLabel(eff.target)} ${amount}${weapon}${cond && cond.value !== 'always' ? ` (${cond.label.toLowerCase()})` : ''}`
}

export default function EffectsEditor({ effects, onChange, charStats, item = false }) {
  const [showHelp, setShowHelp] = useState(false)
  const update = (idx, patch) => {
    const next = effects.map((e, j) => {
      if (j !== idx) return e
      const merged = { ...e, ...patch }
      if (!conditionsForTarget(merged.target, { item }).some(c => c.value === merged.condition)) merged.condition = 'always'
      if (isWeaponTarget(merged.target) && !merged.weapon) merged.weapon = 'all'
      if (!isWeaponTarget(merged.target)) delete merged.weapon
      if (!supportsMinMode(merged.target) || merged.mode !== 'min') delete merged.mode
      return merged
    })
    onChange(next)
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="label text-xs">Effects</div>
        <button type="button" onClick={() => setShowHelp(true)}
          className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2">How do effects work?</button>
      </div>
      {effects.map((eff, idx) => {
        const conds = conditionsForTarget(eff.target, { item })
        const val = effectValue(eff.value, charStats)
        const invalid = String(eff.value ?? '').trim() !== '' && val === null
        const isCalc = eff.target === 'ac_calc'
        const isMin  = eff.mode === 'min' && supportsMinMode(eff.target)
        return (
          <div key={idx} className="bg-stone-900/60 border border-stone-700 rounded-lg p-2 space-y-2">
            {/* Applies to + formula */}
            <div className="flex gap-2 flex-wrap items-end">
              <label className="flex flex-col gap-0.5 w-48">
                <span className="text-xs text-stone-500">Applies to</span>
                <select value={eff.target} onChange={e => update(idx, { target: e.target.value })} className="input w-full">
                  {EFFECT_TARGET_GROUPS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5 flex-1 min-w-48">
                <span className="text-xs text-stone-500">
                  {isCalc ? 'AC formula' : isMin ? 'Minimum' : 'Bonus'} <span className={`tabular-nums ${invalid ? 'text-red-400' : 'text-stone-400'}`}>{invalid ? '— not a number' : `= ${isCalc || isMin ? (val ?? 0) : fmtMod(val ?? 0)}`}</span>
                </span>
                <input value={eff.value ?? ''} onChange={e => update(idx, { value: e.target.value })}
                  onBlur={e => { const canon = canonicalizeFormula(e.target.value); if (canon !== e.target.value) update(idx, { value: canon }) }}
                  className={`input w-full font-mono ${invalid ? 'border-red-600' : ''}`}
                  placeholder={isCalc ? 'e.g. 10+DEX+CON' : isMin ? 'e.g. 19' : 'e.g. 5, PROF/2, 2*LVL'}
                  title="Numbers, STR…CHA, PROF, LVL, <Class>_LVL, min/max/floor/ceil/step" />
              </label>
              <button type="button" onClick={() => onChange(effects.filter((_, j) => j !== idx))}
                className="text-stone-500 hover:text-red-400 p-1.5 rounded hover:bg-stone-700 shrink-0" title="Remove effect">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            {/* Add a bonus, or raise to a minimum */}
            {supportsMinMode(eff.target) && (
              <label className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-stone-500 w-10">Type</span>
                <select value={isMin ? 'min' : 'add'} onChange={e => update(idx, { mode: e.target.value })} className="input w-56">
                  <option value="add">Add bonus</option>
                  <option value="min">Set to at least</option>
                </select>
              </label>
            )}
            {/* Which weapons (weapon targets only) */}
            {isWeaponTarget(eff.target) && (
              <label className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-stone-500 w-10">With</span>
                <select value={eff.weapon || 'all'} onChange={e => update(idx, { weapon: e.target.value })} className="input w-56">
                  {WEAPON_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  <optgroup label="Specific weapon">
                    {SPECIFIC_WEAPONS.map(w => <option key={w} value={`specific:${w}`}>{w}</option>)}
                  </optgroup>
                </select>
              </label>
            )}
            {/* Condition */}
            <label className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-500 w-10">When</span>
              <select value={eff.condition || 'always'} onChange={e => update(idx, { condition: e.target.value })} className="input w-56">
                {conds.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          </div>
        )
      })}
      <button type="button" onClick={() => onChange([...effects, { target: 'initiative', value: '', condition: 'always' }])}
        className="btn btn-secondary btn-sm">
        <PlusIcon className="w-4 h-4 mr-1" /> Add Effect
      </button>
      {showHelp && <EffectsHelp onClose={() => setShowHelp(false)} />}
    </div>
  )
}

// ── In-app documentation for feature effects & formulas ───────────────────────
function HelpTable({ rows }) {
  return (
    <table className="w-full text-sm mb-1">
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i} className="border-b border-stone-800 align-top">
            <td className="py-1 pr-3 font-mono text-amber-300 whitespace-nowrap">{a}</td>
            <td className="py-1 text-stone-300">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EffectsHelp({ onClose }) {
  const H = ({ children }) => <h4 className="text-stone-100 font-semibold mt-5 mb-1.5">{children}</h4>
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-stone-900 border border-stone-700 rounded-xl shadow-xl max-w-2xl w-full max-h-full flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-700">
          <h3 className="text-lg font-bold text-stone-100">Feature effects</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-200 p-1"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 text-sm text-stone-300 leading-relaxed">
          <p className="mt-3">
            Effects let a feature or an inventory item change numbers on the sheet. Each can hold any number of effects, and they are
            active while the feature or item exists — remove it (or the effect) and its bonus disappears. Stats changed by effects show
            a <span className="text-amber-400">✦</span>; tap it to see which features contribute.
          </p>
          <p className="mt-2">
            Each effect has: <b>Applies to</b> (what it changes), a <b>Bonus</b> formula, a <b>When</b> condition, and — depending
            on the target — a <b>Type</b> (add / set to at least) and <b>With</b> (which weapons).
          </p>

          <H>Applies to</H>
          <HelpTable rows={[
            ['Initiative', 'Added to initiative.'],
            ['AC (bonus)', 'Added to AC, after armor and shield.'],
            ['AC calculation (base)', 'An alternative base AC formula (e.g. Unarmored Defense: 10+DEX+CON). The highest of normal armor / 10+DEX and all AC calculations is used; shields and AC bonuses still add on top.'],
            ['Speed', 'Added to walking speed. Halved by exhaustion 2+, and 0 when a condition sets speed to 0.'],
            ['Max HP', 'Added to max HP. Halved by exhaustion 4+.'],
            ['STR … CHA score', 'Builds an auto-calculated ability score (see Ability scores below).'],
            ['Passive Perception / Insight / Investigation', 'Added to that passive score only (e.g. Observant +5). Skill effects already flow into passives.'],
            ['Weapon attack / Weapon damage', 'Added to the attack bonus or damage of matching weapons (see With).'],
            ['A skill / All skills', 'Added to that skill (or every skill). Also flows into passive scores.'],
            ['A save / All saves', 'Added to that saving throw (or every save).'],
          ]} />

          <H>Type: Add bonus / Set to at least</H>
          <p className="mb-1.5">
            <b>Add bonus</b> (the default) adds the formula to the stat. <b>Set to at least</b> raises the stat to the formula's value
            if it's lower, and does nothing if it's already higher — e.g. Gauntlets of Ogre Power: STR score · set to at least 19.
            When a floor wins, the other bonuses no longer matter and the ✦ breakdown shows only the floor.
            Available for ability scores, initiative, AC (bonus), passive scores, skills and saves — not for speed, max HP,
            weapons or AC calculation (which already uses the highest value).
          </p>
          <p>
            Floors also apply to <b>manual</b> ability scores (bonuses don't, since they'd double-count what you typed), so magic
            items like a Headband of Intellect work on older characters too. A manual AC or initiative still replaces everything.
          </p>

          <H>When (conditions)</H>
          <HelpTable rows={[
            ['Always', 'No condition. On an item, this means the effect works even if the item is just in your bag.'],
            ['If attuned', 'Items only: applies only while the item is marked attuned (the ✦ on the item turns grey when inactive).'],
            ['If not proficient', 'Skills & saves only: applies when you are not proficient (e.g. Jack of All Trades).'],
            ['If proficient', 'Skills & saves only: applies when proficient (expertise counts as proficient).'],
            ['If expertise', 'Skills only: applies when you have expertise.'],
            ['If not wearing armor', 'No body armor equipped. A shield is allowed (Barbarian Unarmored Defense).'],
            ['If no armor and no shield', 'Neither armor nor shield equipped (Monk Unarmored Defense / Movement).'],
            ['If not wearing heavy armor', 'Anything but heavy armor (Barbarian Fast Movement).'],
            ['If wearing armor', 'Any body armor equipped (Defense fighting style).'],
          ]} />
          <p>Armor conditions look at the armor marked as <b>equipped</b> in the inventory. Only one condition can be chosen per effect.</p>

          <H>On/Off features</H>
          <p>
            Tick <b>Can be toggled on/off</b> while editing a feature to give it an <b>On/Off</b> switch in the features list.
            Its effects only count while it's on, and it stays on or off until you switch it. Useful for things you choose
            between, such as artificer infusions: add them all up front, then switch on the ones you picked after a long rest.
          </p>

          <H>Item effects</H>
          <p>
            Edit an item in the inventory to add effects, exactly like on features. Use <b>If attuned</b> for items that require
            attunement, so the bonus only counts while you're attuned. An item's own attack, damage and AC formulas still work as
            before — use effects for bonuses that reach beyond the item itself (e.g. a ring that boosts AC and saves).
          </p>

          <H>With (weapon effects)</H>
          <HelpTable rows={[
            ['All weapons', 'Every weapon (not the unarmed strike).'],
            ['Melee / Ranged weapons', 'By the weapon\'s Melee/Ranged setting. Thrown melee weapons count as melee.'],
            ['Simple / Martial weapons', 'By the weapon\'s Simple/Martial setting.'],
            ['One-handed melee weapons', 'Melee weapons without Two-Handed, and not currently used two-handed (Versatile off) — e.g. Dueling.'],
            ['Unarmed strike', 'Only the unarmed strike row.'],
            ['Specific weapon', 'Only weapons of that type (e.g. Longbow).'],
          ]} />

          <H>Formulas</H>
          <p className="mb-1.5">Formulas are used by effects and by weapon/armor fields. Results of effects are rounded down. Letters are case-insensitive, and abbreviations are rewritten to the standard form when you leave the field.</p>
          <HelpTable rows={[
            ['STR DEX CON INT WIS CHA', 'Ability modifier. Also: strength, dexterity, constitution, intelligence, wisdom, charisma.'],
            ['PROF', 'Proficiency bonus. Also: PB, proficiency.'],
            ['LVL', 'Total character level. Also: LV, level, CLASS_LVL.'],
            ['<Class>_LVL', 'Level in one class, e.g. MONK_LVL, BLOOD_HUNTER_LVL (spaces become _). 0 if you don\'t have the class. Also: _LV, _level.'],
            ['+ - * / ( )', 'Arithmetic.'],
            ['min(a, b, …) / max(a, b, …)', 'Smallest / largest value, e.g. max(1, CHA).'],
            ['floor(x) / ceil(x)', 'Round down / up, e.g. ceil(PROF/2).'],
            ['step(x, t1, v1, t2, v2, …)', 'Value for the highest threshold x reached; 0 below the first. E.g. step(MONK_LVL, 2,10, 6,15) is 0 at level 1, 10 at 2–5, 15 from 6.'],
            ['1d8, 2d6', 'Dice — kept as-is in damage. Not allowed in effects (effects must be a number).'],
            ['[fire]', 'Damage type tag in damage formulas, e.g. 1d8+STR[slashing] + 2d6[fire].'],
          ]} />

          <H>Ability scores</H>
          <p>
            Like AC and initiative, each ability score is either <b>manual</b> (the number you typed) or <b>auto</b>.
            Clear a score and leave the field to make it auto: it becomes the sum of that ability's effects. There is no cap — keep the 5e limit of 20 in mind yourself (some features, like Primal Champion, go beyond it).
            Type a number to make it manual again (bonus effects are then ignored for that score; "set to at least" still applies).
            New characters start with a <b>Base Ability Scores</b> feature giving 10 to each — edit its effects to set your
            base scores, and add racial bonuses / improvements as effects on their own features.
            Ability effects can't use ability modifiers in their formulas.
          </p>

          <H>Manual values</H>
          <p>If you type an AC or initiative value yourself, that value replaces everything, including effects. Clear it to go back to auto.
            Speed and max HP show the stored value plus effects; editing them stores the value without the effects.</p>

          <H>Max HP</H>
          <p>
            Max HP is manual (the number you typed) or <b>auto</b>. Clear the max HP field to make it auto: it becomes the sum of
            every class level's hit die result + CON modifier × total level + Max HP effects (halved at exhaustion 4+).
            Each class records one hit die result per level — expand a class to see them, and edit them in the class's edit mode.
            A newly added class records its die's max for its first level; <b>Level Up!</b> asks for the new level's roll
            (type it, or roll / take the average / take the max), and the max HP gained is added to current HP. Levels without a recorded result count as the average.
            New characters start in auto mode; existing ones stay manual until you clear the field.
          </p>

          <H>Examples</H>
          <HelpTable rows={[
            ['Alert', 'Initiative · 5'],
            ['Jack of All Trades', 'All skills · PROF/2 · If not proficient; plus Initiative · PROF/2'],
            ['Remarkable Athlete', 'Athletics, Acrobatics, Sleight of Hand, Stealth · ceil(PROF/2) · If not proficient; plus Initiative · ceil(PROF/2)'],
            ['Tough', 'Max HP · 2*LVL'],
            ['Dwarven Toughness', 'Max HP · LVL'],
            ['Draconic Resilience', 'Max HP · SORCERER_LVL; AC calculation · 13+DEX · If not wearing armor'],
            ['Archery', 'Weapon attack · 2 · With ranged weapons'],
            ['Dueling', 'Weapon damage · 2 · With one-handed melee weapons'],
            ['Defense', 'AC (bonus) · 1 · If wearing armor'],
            ['Unarmored Defense (Barbarian)', 'AC calculation · 10+DEX+CON · If not wearing armor'],
            ['Unarmored Defense (Monk)', 'AC calculation · 10+DEX+WIS · If no armor and no shield'],
            ['Unarmored Movement', 'Speed · step(MONK_LVL, 2,10, 6,15, 10,20, 14,25, 18,30) · If no armor and no shield'],
            ['Fast Movement', 'Speed · 10 · If not wearing heavy armor'],
            ['Observant', 'Passive Perception · 5; Passive Investigation · 5'],
            ['Aura of Protection', 'All saves · max(1, CHA)'],
            ['Cloak / Ring of Protection (item)', 'AC (bonus) · 1 · If attuned; All saves · 1 · If attuned'],
            ['Stone of Good Luck (item)', 'All skills · 1 · If attuned; All saves · 1 · If attuned'],
            ['Gauntlets of Ogre Power (item)', 'STR score · Set to at least · 19 · If attuned'],
            ['Headband of Intellect (item)', 'INT score · Set to at least · 19 · If attuned'],
            ['Belt of Hill Giant Strength (item)', 'STR score · Set to at least · 21 · If attuned'],
            ['Ability Score Improvement', 'STR score · 2 (or two scores · 1)'],
          ]} />
        </div>
      </div>
    </div>
  )
}
