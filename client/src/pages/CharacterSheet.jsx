import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { PlusIcon, TrashIcon, ChevronDownIcon, PencilIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline'
import EquipmentSection from '../components/EquipmentSection'
import Modal from '../components/Modal'
import { evalFormula } from '../utils/formulaEval'

const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const ABILITY_SHORT = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' }

const SKILLS = [
  { name: 'Acrobatics', ability: 'dexterity' },
  { name: 'Animal Handling', ability: 'wisdom' },
  { name: 'Arcana', ability: 'intelligence' },
  { name: 'Athletics', ability: 'strength' },
  { name: 'Deception', ability: 'charisma' },
  { name: 'History', ability: 'intelligence' },
  { name: 'Insight', ability: 'wisdom' },
  { name: 'Intimidation', ability: 'charisma' },
  { name: 'Investigation', ability: 'intelligence' },
  { name: 'Medicine', ability: 'wisdom' },
  { name: 'Nature', ability: 'intelligence' },
  { name: 'Perception', ability: 'wisdom' },
  { name: 'Performance', ability: 'charisma' },
  { name: 'Persuasion', ability: 'charisma' },
  { name: 'Religion', ability: 'intelligence' },
  { name: 'Sleight of Hand', ability: 'dexterity' },
  { name: 'Stealth', ability: 'dexterity' },
  { name: 'Survival', ability: 'wisdom' },
]

const ALIGNMENTS = ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil']
const SPELL_LEVELS = [0,1,2,3,4,5,6,7,8,9]

// Spell level color palette — index = spell level (0=cantrip … 9=9th)
// Progression: neutral → sky/blue → purple → fuchsia/rose → orange/amber (escalating power)
const SPELL_LEVEL_COLORS = [
  { label: 'Cantrips',  ring: 'border-stone-600',   header: 'bg-stone-800',    text: 'text-stone-300'   },
  { label: '1st Level', ring: 'border-sky-700',      header: 'bg-sky-950',      text: 'text-sky-300'     },
  { label: '2nd Level', ring: 'border-blue-700',     header: 'bg-blue-950',     text: 'text-blue-300'    },
  { label: '3rd Level', ring: 'border-indigo-700',   header: 'bg-indigo-950',   text: 'text-indigo-300'  },
  { label: '4th Level', ring: 'border-violet-700',   header: 'bg-violet-950',   text: 'text-violet-300'  },
  { label: '5th Level', ring: 'border-purple-700',   header: 'bg-purple-950',   text: 'text-purple-300'  },
  { label: '6th Level', ring: 'border-fuchsia-700',  header: 'bg-fuchsia-950',  text: 'text-fuchsia-300' },
  { label: '7th Level', ring: 'border-pink-700',     header: 'bg-pink-950',     text: 'text-pink-300'    },
  { label: '8th Level', ring: 'border-orange-700',   header: 'bg-orange-950',   text: 'text-orange-300'  },
  { label: '9th Level', ring: 'border-amber-600',    header: 'bg-amber-950',    text: 'text-amber-300'   },
]
const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious']
const EXHAUSTION_DOT_COLORS = [
  null,
  { on: 'bg-yellow-400 border-yellow-300',   off: 'border-stone-600 hover:border-yellow-700' },
  { on: 'bg-orange-400 border-orange-300',   off: 'border-stone-600 hover:border-orange-700' },
  { on: 'bg-orange-600 border-orange-500',   off: 'border-stone-600 hover:border-orange-600' },
  { on: 'bg-red-600   border-red-500',       off: 'border-stone-600 hover:border-red-600'    },
  { on: 'bg-red-800   border-red-700',       off: 'border-stone-600 hover:border-red-700'    },
  { on: 'bg-stone-950 border-red-900',       off: 'border-stone-600 hover:border-red-900'    },
]
const EXHAUSTION_EFFECTS = [
  null,
  'Level 1 — Disadvantage on all ability checks.',
  'Level 2 — Speed halved. (+ all prior effects)',
  'Level 3 — Disadvantage on attack rolls and saving throws. (+ all prior effects)',
  'Level 4 — Hit point maximum halved. (+ all prior effects)',
  'Level 5 — Speed reduced to 0. (+ all prior effects)',
  'Level 6 — Death.',
]

const CONDITION_DESC = {
  Blinded:       "Can't see. Attacks against you have advantage; your attacks have disadvantage. You automatically fail sight-based checks.",
  Charmed:       "Can't attack the charmer or target them with harmful abilities/spells. The charmer has advantage on social checks against you.",
  Deafened:      "Can't hear. Automatically fail hearing-based checks.",
  Exhaustion:    "Cumulative levels (1–6) impose penalties: disadvantage on ability checks (1), halved speed (2), disadvantage on attacks & saves (3), halved HP max (4), speed 0 (5). At 6 you die.",
  Frightened:    "Disadvantage on ability checks and attacks while you can see the source of fear. Can't willingly move closer to the source.",
  Grappled:      "Speed becomes 0. Ends if the grappler is incapacitated, or if you're moved out of reach.",
  Incapacitated: "Can't take actions or reactions.",
  Invisible:     "Can't be seen without magic. Attacks against you have disadvantage; your attacks have advantage.",
  Paralyzed:     "Incapacitated, can't move or speak. Auto-fail STR & DEX saves. Attacks against you have advantage. Any hit from within 5 ft is a critical hit.",
  Petrified:     "Transformed into solid matter. Incapacitated, speed 0, unaware of surroundings. Resistance to all damage. Immune to poison and disease.",
  Poisoned:      "Disadvantage on attack rolls and ability checks.",
  Prone:         "Disadvantage on attacks. Attackers within 5 ft have advantage; others have disadvantage. Standing up costs half your speed.",
  Restrained:    "Speed becomes 0. Attacks against you have advantage; your attacks have disadvantage. Disadvantage on DEX saves.",
  Stunned:       "Incapacitated, can't move, can only speak falteringly. Auto-fail STR & DEX saves. Attacks against you have advantage.",
  Unconscious:   "Incapacitated, can't move or speak, unaware of surroundings. Drop everything, fall prone. Auto-fail STR & DEX saves. Attacks have advantage; hits within 5 ft are crits.",
}

function mod(score) {
  return Math.floor((score - 10) / 2)
}

const HD_DIE_SIZES = [4, 6, 8, 10, 12, 20]

const WEAPON_TYPES = {
  'simple-melee': 'Simple Melee', 'simple-ranged': 'Simple Ranged',
  'martial-melee': 'Martial Melee', 'martial-ranged': 'Martial Ranged',
}

function parseHitDice(str) {
  if (!str) return []
  return str.split('+').map(s => {
    const m = s.trim().match(/^(\d+)[dD](\d+)$/)
    return m ? { count: parseInt(m[1]), size: parseInt(m[2]) } : null
  }).filter(Boolean)
}

function stringifyHitDice(dice) {
  return dice.filter(d => d.count > 0)
    .sort((a, b) => a.size - b.size)
    .map(d => `${d.count}d${d.size}`)
    .join('+')
}

function computeHitDice(classes) {
  const counts = {}
  for (const cls of classes) {
    const m = String(cls.hit_die || '').match(/^(\d*)[dD](\d+)$/)
    if (!m) continue
    const size = m[2]
    const perLevel = parseInt(m[1]) || 1
    const count = perLevel * (parseInt(cls.level) || 0)
    if (count > 0) counts[size] = (counts[size] || 0) + count
  }
  return Object.entries(counts)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([s, c]) => `${c}d${s}`)
    .join('+')
}

function cleanHitDiceInput(str) {
  // Keep only valid ndm segments, drop free text / bare numbers
  if (!str) return ''
  return str.split(/[+,\s]+/).map(s => {
    const m = s.trim().match(/^(\d+)[dD](\d+)$/)
    return m && parseInt(m[1]) > 0 && parseInt(m[2]) > 0 ? `${m[1]}d${m[2]}` : null
  }).filter(Boolean).join('+')
}

const CONDITION_CHAINS = {
  Paralyzed:   ['Incapacitated'],
  Petrified:   ['Incapacitated'],
  Stunned:     ['Incapacitated'],
  Unconscious: ['Incapacitated', 'Prone'],
}

const SPEED_ZERO_CONDITIONS = new Set(['Grappled', 'Paralyzed', 'Petrified', 'Restrained', 'Stunned', 'Unconscious'])

function computeEffectiveSpeed(base, conditions, exhaustion) {
  if (conditions.some(c => SPEED_ZERO_CONDITIONS.has(c))) return 0
  if (exhaustion >= 5) return 0
  if (exhaustion >= 2) return Math.floor(base / 2)
  return base
}
function fmtMod(n) {
  return n >= 0 ? `+${n}` : `${n}`
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card mb-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between section-title cursor-pointer"
      >
        {title}
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

function NumberInput({ label, name, register, small }) {
  return (
    <div className={small ? 'stat-box' : ''}>
      {label && <div className="label text-xs text-center">{label}</div>}
      <input type="number" {...register(name, { valueAsNumber: true })}
        className={small ? 'input text-center text-lg font-bold p-1' : 'input'} />
    </div>
  )
}

const SPELL_SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation']

const SPELL_FILTERS_GENERAL = [
  { key: 'action',   label: 'Action',       accepts: (sp)      => /^(1 )?action$/i.test((sp.cast_time || '').trim()) },
  { key: 'bonus',    label: 'Bonus Action', accepts: (sp)      => /^(1 )?bonus action$/i.test((sp.cast_time || '').trim()) },
  { key: 'prepared', label: 'Prepared',     accepts: (sp, lvl) => lvl === 0 || !!sp.prepared },
  { key: 'ritual',   label: 'Ritual',       accepts: (sp)      => !!sp.ritual },
  { key: 'vocal',    label: 'Vocal',        accepts: (sp)      => !!sp.comp_v },
  { key: 'somatic',  label: 'Somatic',      accepts: (sp)      => !!sp.comp_s },
]
const SPELL_FILTERS_SCHOOLS = SPELL_SCHOOLS.map(s => ({ key: `school_${s}`, label: s, accepts: (sp) => sp.school === s }))
const SPELL_FILTERS = [...SPELL_FILTERS_GENERAL, ...SPELL_FILTERS_SCHOOLS]

const FILTER_STATE_CLASSES = {
  0: 'bg-transparent text-stone-500 border-stone-700 hover:text-stone-400 hover:border-stone-500',
  1: 'bg-blue-900/40 text-blue-300 border-blue-700 hover:bg-blue-900/60',
  2: 'bg-red-900/40 text-red-300 border-red-700 hover:bg-red-900/60',
}

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.+^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}
function setCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${365 * 24 * 3600}`
}

const ATTACKS_SPELL_FILTERS_GENERAL = SPELL_FILTERS_GENERAL.filter(f => f.key !== 'prepared')

function AttacksSpellcastingBlock({ classIndex, className, castingAbility, control, watch, setValue, watchedProfBonus, watchedAbilities }) {
  const allSpells = useWatch({ control, name: `classes.${classIndex}.spells` }) || []

  const cookieKey = `grimoire_atk_exp_${(className || 'unknown').replace(/\W+/g, '_')}`
  const [blockExpanded, setBlockExpanded] = useState(() => {
    const v = getCookie(cookieKey); return v === null ? true : v === 'true'
  })
  const [expandedLevels, setExpandedLevels] = useState(() => new Set(SPELL_LEVELS))
  const [expandedSpells, setExpandedSpells] = useState(new Set())
  const [filterStates,   setFilterStates]   = useState(() => {
    try { const s = localStorage.getItem(`grimoire_atk_filters_${classIndex}`); return s ? JSON.parse(s) : {} } catch { return {} }
  })

  const abilityIdx  = ABILITIES.indexOf(castingAbility)
  const abilityMod  = abilityIdx >= 0 ? Math.floor(((watchedAbilities[abilityIdx] ?? 10) - 10) / 2) : 0
  const saveDC      = 8 + watchedProfBonus + abilityMod
  const attackBonus = watchedProfBonus + abilityMod

  function toggleBlock() {
    const next = !blockExpanded; setBlockExpanded(next); setCookie(cookieKey, String(next))
  }
  function cycleFilter(key) {
    setFilterStates(prev => {
      const next = ((prev[key] || 0) + 1) % 3
      const updated = { ...prev }
      if (next === 0) delete updated[key]; else updated[key] = next
      try { localStorage.setItem(`grimoire_atk_filters_${classIndex}`, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  const allFilters  = [...ATTACKS_SPELL_FILTERS_GENERAL, ...SPELL_FILTERS_SCHOOLS]
  const showFilters = allFilters.filter(f => filterStates[f.key] === 1)
  const hideFilters = allFilters.filter(f => filterStates[f.key] === 2)

  function spellVisible(sp, lvl) {
    if (hideFilters.some(f => f.accepts(sp, lvl))) return false
    if (showFilters.length > 0 && !showFilters.every(f => f.accepts(sp, lvl))) return false
    return true
  }
  function hasSlotAtOrAbove(lvl) {
    if (lvl === 0) return true
    return SPELL_LEVELS.filter(l => l >= lvl).some(l =>
      (parseInt(watch(`classes.${classIndex}.spell_slots.${l}.left`)) || 0) > 0
    )
  }
  function hasMaxSlotAtOrAbove(lvl) {
    if (lvl === 0) return true
    return SPELL_LEVELS.filter(l => l >= lvl).some(l =>
      (parseInt(watch(`classes.${classIndex}.spell_slots.${l}.max`)) || 0) > 0
    )
  }

  return (
    <div className="mt-5 border-t border-stone-700 pt-4">
      {/* Block header */}
      <div className="flex items-center justify-between cursor-pointer select-none mb-3" onClick={toggleBlock}>
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          {className || 'Unknown'} Spellcasting
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-stone-500 transition-transform ${blockExpanded ? '' : '-rotate-90'}`} />
      </div>

      {blockExpanded && (
        <>
          {/* Attack bonus + Save DC */}
          <div className="flex justify-around mb-4">
            <div className="stat-box text-center min-w-24">
              <div className="label text-xs text-center">Spell Attack</div>
              <div className="text-2xl font-bold text-center text-stone-100 py-1">{fmtMod(attackBonus)}</div>
            </div>
            <div className="stat-box text-center min-w-24">
              <div className="label text-xs text-center">Spell Save DC</div>
              <div className="text-2xl font-bold text-center text-stone-100 py-1">{saveDC}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-1 mb-3">
            <div className="flex flex-wrap gap-1">
              {ATTACKS_SPELL_FILTERS_GENERAL.map(f => (
                <button key={f.key} type="button" onClick={() => cycleFilter(f.key)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${FILTER_STATE_CLASSES[filterStates[f.key] || 0]}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {SPELL_FILTERS_SCHOOLS.map(f => (
                <button key={f.key} type="button" onClick={() => cycleFilter(f.key)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${FILTER_STATE_CLASSES[filterStates[f.key] || 0]}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spellbook — read-only */}
          <div className="space-y-1">
            {SPELL_LEVELS.map(lvl => {
              if (!hasMaxSlotAtOrAbove(lvl)) return null
              const c = SPELL_LEVEL_COLORS[lvl]
              const levelSpells = allSpells
                .map((sp, i) => ({ sp, i }))
                .filter(({ sp }) => (sp?.level ?? 0) === lvl && (lvl === 0 || !!sp?.prepared))
              const slotsAvailable = hasSlotAtOrAbove(lvl)
              const visibleSpells  = slotsAvailable ? levelSpells.filter(({ sp }) => spellVisible(sp, lvl)) : []
              const isFiltering   = showFilters.length > 0 || hideFilters.length > 0
              const isOpen        = expandedLevels.has(lvl)

              return (
                <div key={lvl} className={`rounded-lg border ${c.ring} overflow-hidden`}>
                  <div className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none ${c.header}`}
                    onClick={() => setExpandedLevels(prev => { const n = new Set(prev); n.has(lvl) ? n.delete(lvl) : n.add(lvl); return n })}>
                    <ChevronDownIcon className={`w-4 h-4 ${c.text} shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    <span className={`text-sm font-semibold ${c.text} flex-1`}>{c.label}</span>
                    {lvl > 0 && (
                      <div className="flex items-center gap-1.5 text-xs" onClick={e => e.stopPropagation()}>
                        <button type="button"
                          onClick={() => {
                            const max  = parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.max`))  || 0
                            const left = parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.left`)) || 0
                            if (left < max) setValue(`classes.${classIndex}.spell_slots.${lvl}.left`, left + 1, { shouldDirty: true })
                          }}
                          className={`px-1.5 py-0.5 rounded border border-stone-600 ${c.text} opacity-70 hover:opacity-100 hover:border-stone-500 transition-opacity`}>
                          Add slot
                        </button>
                        <span className={`${c.text} opacity-60`}>Slots:</span>
                        <span className={`${c.text} tabular-nums`}>
                          {parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.left`)) || 0}/
                          {parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.max`))  || 0}
                        </span>
                        <button type="button"
                          onClick={() => {
                            const left = parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.left`)) || 0
                            if (left > 0) setValue(`classes.${classIndex}.spell_slots.${lvl}.left`, left - 1, { shouldDirty: true })
                          }}
                          className={`px-1.5 py-0.5 rounded border border-stone-600 ${c.text} opacity-70 hover:opacity-100 hover:border-stone-500 transition-opacity`}>
                          Use
                        </button>
                      </div>
                    )}
                    <span className={`text-xs ${c.text} opacity-50`}>
                      {isFiltering && visibleSpells.length !== levelSpells.length
                        ? `${visibleSpells.length}/${levelSpells.length}`
                        : levelSpells.length}
                    </span>
                  </div>

                  {isOpen && (
                    <div className="divide-y divide-stone-700/40">
                      {!slotsAvailable && levelSpells.length === 0 && (
                        <p className="text-stone-600 text-xs italic px-3 py-2">No remaining slots. No spells.</p>
                      )}
                      {!slotsAvailable && levelSpells.length > 0 && (
                        <p className="text-stone-600 text-xs italic px-3 py-2">No remaining slots.</p>
                      )}
                      {slotsAvailable && levelSpells.length === 0 && (
                        <p className="text-stone-600 text-xs italic px-3 py-2">No spells.</p>
                      )}
                      {slotsAvailable && levelSpells.length > 0 && visibleSpells.length === 0 && (
                        <p className="text-stone-600 text-xs italic px-3 py-2">No spells match the active filters.</p>
                      )}
                      {visibleSpells.map(({ sp, i }) => {
                        const key     = `${classIndex}-${i}`
                        const isOpen2 = expandedSpells.has(key)
                        const compParts   = [sp.comp_v && 'V', sp.comp_s && 'S', sp.comp_m && 'M'].filter(Boolean)
                        const compDisplay = compParts.length
                          ? compParts.join(', ') + (sp.comp_m && sp.comp_m_text ? ` (${sp.comp_m_text})` : '')
                          : null
                        const hasDetail = sp.school || compDisplay || sp.duration || sp.description
                        return (
                          <div key={key}>
                            <div className="flex items-start gap-1.5 px-3 py-2 cursor-pointer select-none"
                              onClick={() => setExpandedSpells(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })}>
                              <ChevronDownIcon className={`w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5 transition-transform ${isOpen2 ? '' : '-rotate-90'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                  <span className="text-stone-100 text-sm">
                                    {sp.name || <span className="text-stone-500 italic">Unnamed spell</span>}
                                  </span>
                                  {sp.ritual && <span className="text-stone-500 text-xs italic shrink-0">(ritual)</span>}
                                </div>
                                {(sp.cast_time || sp.range) && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    {sp.cast_time && <span className="text-xs text-stone-500"><span className="text-stone-600">Casting Time:</span> {sp.cast_time}</span>}
                                    {sp.range     && <span className="text-xs text-stone-500"><span className="text-stone-600">Range:</span> {sp.range}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                            {isOpen2 && hasDetail && (
                              <div className="px-4 pb-3 border-t border-stone-700/40 pt-2 space-y-1.5">
                                {sp.school      && <p className="text-xs text-stone-400"><span className="text-stone-500">School:</span> {sp.school}</p>}
                                {compDisplay    && <p className="text-xs text-stone-400"><span className="text-stone-500">Components:</span> {compDisplay}</p>}
                                {sp.duration    && <p className="text-xs text-stone-400"><span className="text-stone-500">Duration:</span> {sp.duration}</p>}
                                {sp.description && <p className="text-stone-300 text-sm whitespace-pre-wrap">{sp.description}</p>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function SpellcastingBlock({ classIndex, castingAbility, control, register, watch, setValue, readOnly, watchedProfBonus, watchedAbilities }) {
  const { fields: spellFields, append: addSpell, remove: removeSpell } = useFieldArray({
    control, name: `classes.${classIndex}.spells`,
  })
  const allSpells = useWatch({ control, name: `classes.${classIndex}.spells` }) || []

  const [expandedLevels, setExpandedLevels] = useState(() => {
    const occupied = new Set(allSpells.map(sp => sp?.level ?? 0))
    return new Set(SPELL_LEVELS.filter(lvl => occupied.has(lvl)))
  })
  const [expandedSpells, setExpandedSpells] = useState(new Set())
  const [editingSpells,  setEditingSpells]  = useState(new Set())
  const [noSlotsModal,   setNoSlotsModal]   = useState(null)
  const [filterStates,   setFilterStates]   = useState(() => {
    try { const s = localStorage.getItem('grimoire_spell_filters'); return s ? JSON.parse(s) : {} }
    catch { return {} }
  })
  const prevSpellsLengthRef = useRef(0)
  const pendingNewSpell = useRef(false)

  useEffect(() => {
    if (pendingNewSpell.current && spellFields.length > prevSpellsLengthRef.current) {
      const newId = spellFields[spellFields.length - 1].id
      setEditingSpells(prev => new Set([...prev, newId]))
      pendingNewSpell.current = false
    }
    prevSpellsLengthRef.current = spellFields.length
  }, [spellFields.length])

  const abilityIdx  = ABILITIES.indexOf(castingAbility)
  const abilityMod  = abilityIdx >= 0 ? Math.floor(((watchedAbilities[abilityIdx] ?? 10) - 10) / 2) : 0
  const saveDC      = 8 + watchedProfBonus + abilityMod
  const attackBonus = watchedProfBonus + abilityMod

  function toggleLevel(lvl) {
    setExpandedLevels(prev => { const n = new Set(prev); n.has(lvl) ? n.delete(lvl) : n.add(lvl); return n })
  }
  function addSpellAtLevel(lvl) {
    pendingNewSpell.current = true
    addSpell({ level: lvl, name: '', cast_time: '', range: '', duration: '', school: '', ritual: false, comp_v: false, comp_s: false, comp_m: false, comp_m_text: '', prepared: false, description: '' })
    setExpandedLevels(prev => new Set([...prev, lvl]))
  }
  function startEditSpell(fieldId) { setEditingSpells(prev => new Set([...prev, fieldId])) }
  function stopEditSpell(fieldId)  { setEditingSpells(prev => { const n = new Set(prev); n.delete(fieldId); return n }) }
  function toggleExpandSpell(fieldId) {
    setExpandedSpells(prev => { const n = new Set(prev); n.has(fieldId) ? n.delete(fieldId) : n.add(fieldId); return n })
  }
  function removeSpellByIndex(fieldId, i) {
    setEditingSpells(prev => { const n = new Set(prev); n.delete(fieldId); return n })
    setExpandedSpells(prev => { const n = new Set(prev); n.delete(fieldId); return n })
    removeSpell(i)
  }
  function cycleFilter(key) {
    setFilterStates(prev => {
      const curr = prev[key] || 0
      const next = (curr + 1) % 3
      const updated = { ...prev }
      if (next === 0) delete updated[key]
      else updated[key] = next
      try { localStorage.setItem('grimoire_spell_filters', JSON.stringify(updated)) } catch {}
      return updated
    })
  }
  const showFilters = SPELL_FILTERS.filter(f => filterStates[f.key] === 1)
  const hideFilters = SPELL_FILTERS.filter(f => filterStates[f.key] === 2)
  function spellVisible(sp, lvl) {
    if (hideFilters.some(f => f.accepts(sp, lvl))) return false
    if (showFilters.length > 0 && !showFilters.every(f => f.accepts(sp, lvl))) return false
    return true
  }

  function handleUseSlot(lvl) {
    const left = parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.left`)) || 0
    if (left <= 0) { setNoSlotsModal({ lvl }); return }
    setValue(`classes.${classIndex}.spell_slots.${lvl}.left`, left - 1, { shouldDirty: true })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="stat-box">
          <div className="label text-xs text-center">Spell Save DC</div>
          <div className="text-2xl font-bold text-center text-stone-100 py-1">{saveDC}</div>
        </div>
        <div className="stat-box">
          <div className="label text-xs text-center">Spell Attack</div>
          <div className="text-2xl font-bold text-center text-stone-100 py-1">{fmtMod(attackBonus)}</div>
        </div>
        <span className="text-stone-500 text-xs">{ABILITY_SHORT[castingAbility]} · Prof +{watchedProfBonus}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-1 mb-3">
        <div className="flex flex-wrap gap-1">
          {SPELL_FILTERS_GENERAL.map(f => (
            <button key={f.key} type="button" onClick={() => cycleFilter(f.key)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${FILTER_STATE_CLASSES[filterStates[f.key] || 0]}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {SPELL_FILTERS_SCHOOLS.map(f => (
            <button key={f.key} type="button" onClick={() => cycleFilter(f.key)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${FILTER_STATE_CLASSES[filterStates[f.key] || 0]}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {SPELL_LEVELS.map(lvl => {
          const c = SPELL_LEVEL_COLORS[lvl]
          const levelSpells = spellFields.map((f, i) => ({ field: f, i })).filter(({ i }) => (allSpells[i]?.level ?? 0) === lvl)
          const visibleSpells = levelSpells.filter(({ field, i }) => editingSpells.has(field.id) || spellVisible(allSpells[i] || {}, lvl))
          const isFiltering = showFilters.length > 0 || hideFilters.length > 0
          const isOpen = expandedLevels.has(lvl)
          return (
            <div key={lvl} className={`rounded-lg border ${c.ring} overflow-hidden`}>
              {/* Level header */}
              <div className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none ${c.header}`}
                onClick={() => toggleLevel(lvl)}>
                <ChevronDownIcon className={`w-4 h-4 ${c.text} shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                <span className={`text-sm font-semibold ${c.text} flex-1`}>{c.label}</span>
                {lvl > 0 && (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button type="button"
                      onClick={() => {
                        const max  = parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.max`))  || 0
                        const left = parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.left`)) || 0
                        if (left < max) setValue(`classes.${classIndex}.spell_slots.${lvl}.left`, left + 1, { shouldDirty: true })
                      }}
                      className={`text-xs px-1.5 py-0.5 rounded border border-stone-600 ${c.text} opacity-70 hover:opacity-100 hover:border-stone-500 transition-opacity`}>
                      Add slot
                    </button>
                    <span className={`text-xs ${c.text} opacity-60`}>Slots:</span>
                    <input type="number" min={0}
                      {...register(`classes.${classIndex}.spell_slots.${lvl}.left`, {
                        valueAsNumber: true,
                        onChange: e => {
                          const max = parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.max`)) || 0
                          const val = parseInt(e.target.value) || 0
                          if (val > max) setValue(`classes.${classIndex}.spell_slots.${lvl}.left`, max, { shouldDirty: true })
                        }
                      })}
                      className={`no-spinner w-8 bg-transparent border border-stone-700 rounded text-center text-xs p-0.5 ${c.text} focus:outline-none`}
                      disabled={readOnly} />
                    <span className={`text-xs ${c.text} opacity-50`}>/</span>
                    <input type="number" min={0}
                      {...register(`classes.${classIndex}.spell_slots.${lvl}.max`, {
                        valueAsNumber: true,
                        onChange: e => {
                          const max = parseInt(e.target.value) || 0
                          const left = parseInt(watch(`classes.${classIndex}.spell_slots.${lvl}.left`)) || 0
                          if (left > max) setValue(`classes.${classIndex}.spell_slots.${lvl}.left`, max, { shouldDirty: true })
                        }
                      })}
                      className={`no-spinner w-8 bg-transparent border border-stone-700 rounded text-center text-xs p-0.5 ${c.text} focus:outline-none`}
                      disabled={readOnly} />
                    <button type="button" onClick={() => handleUseSlot(lvl)}
                      className={`text-xs px-1.5 py-0.5 rounded border border-stone-600 ${c.text} opacity-70 hover:opacity-100 hover:border-stone-500 transition-opacity`}>
                      Use slot
                    </button>
                  </div>
                )}
                {levelSpells.length > 0 && (
                  <span className={`text-xs ${c.text} opacity-50`}>
                    {isFiltering && visibleSpells.length !== levelSpells.length
                      ? `${visibleSpells.length}/${levelSpells.length}`
                      : levelSpells.length}
                  </span>
                )}
              </div>

              {/* Level body */}
              {isOpen && (
                <div className="divide-y divide-stone-700/40">
                  {levelSpells.length === 0 && (
                    <p className="text-stone-600 text-xs italic px-3 py-2">No spells.</p>
                  )}
                  {levelSpells.length > 0 && visibleSpells.length === 0 && (
                    <p className="text-stone-600 text-xs italic px-3 py-2">No spells match the active filters.</p>
                  )}
                  {visibleSpells.map(({ field, i }) => {
                    const isEditingSpell  = editingSpells.has(field.id)
                    const isExpandedSpell = expandedSpells.has(field.id)
                    const sp = allSpells[i] || {}

                    // Build components string for display
                    const compParts = [sp.comp_v && 'V', sp.comp_s && 'S', sp.comp_m && 'M'].filter(Boolean)
                    const compDisplay = compParts.length > 0
                      ? compParts.join(', ') + (sp.comp_m && sp.comp_m_text ? ` (${sp.comp_m_text})` : '')
                      : null

                    const hasExpandedContent = sp.school || compDisplay || sp.duration || sp.description

                    return (
                      <div key={field.id}>
                        {isEditingSpell && !readOnly ? (
                          <div className="px-3 py-2 space-y-2">
                            {/* Row 1: name, cast time, range + action buttons */}
                            <div className="flex gap-2 flex-wrap items-center">
                              <input {...register(`classes.${classIndex}.spells.${i}.name`)} className="input flex-1 min-w-32" placeholder="Spell name" autoFocus={!sp.name} />
                              <input {...register(`classes.${classIndex}.spells.${i}.cast_time`)} className="input w-28" placeholder="Cast time" />
                              <input {...register(`classes.${classIndex}.spells.${i}.range`)} className="input w-24" placeholder="Range" />
                              <button type="button" onClick={() => stopEditSpell(field.id)}
                                className="text-green-400 hover:text-green-300 p-1.5 rounded hover:bg-stone-700 shrink-0">
                                <CheckIcon className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => removeSpellByIndex(field.id, i)}
                                className="text-stone-500 hover:text-red-400 p-1.5 rounded hover:bg-stone-700 shrink-0">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                            {/* Row 2: school, duration, prepared, ritual */}
                            <div className="flex gap-2 flex-wrap items-center">
                              <select {...register(`classes.${classIndex}.spells.${i}.school`)} className="input w-40">
                                <option value="">— School —</option>
                                {SPELL_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <input {...register(`classes.${classIndex}.spells.${i}.duration`)} className="input w-32" placeholder="Duration" />
                              {lvl > 0 && (
                                <label className="flex items-center gap-1 text-xs text-stone-400 shrink-0 cursor-pointer">
                                  <input type="checkbox" {...register(`classes.${classIndex}.spells.${i}.prepared`)} className="accent-red-700" />
                                  Prepared
                                </label>
                              )}
                              <label className="flex items-center gap-1 text-xs text-stone-400 shrink-0 cursor-pointer">
                                <input type="checkbox" {...register(`classes.${classIndex}.spells.${i}.ritual`)} className="accent-stone-500" />
                                Ritual
                              </label>
                            </div>
                            {/* Row 3: components */}
                            <div className="flex gap-3 flex-wrap items-center">
                              <span className="text-xs text-stone-400">Components:</span>
                              {['V','S','M'].map(comp => (
                                <label key={comp} className="flex items-center gap-1 text-xs text-stone-400 cursor-pointer">
                                  <input type="checkbox" {...register(`classes.${classIndex}.spells.${i}.comp_${comp.toLowerCase()}`)} className="accent-stone-500" />
                                  {comp}
                                </label>
                              ))}
                              {sp.comp_m && (
                                <input {...register(`classes.${classIndex}.spells.${i}.comp_m_text`)} className="input flex-1 min-w-40 text-sm" placeholder="Material components" />
                              )}
                            </div>
                            {/* Row 4: description */}
                            <textarea {...register(`classes.${classIndex}.spells.${i}.description`)} className="input w-full resize-none text-sm"
                              rows={2} placeholder="Description (optional)" style={{ whiteSpace: 'pre-wrap' }} />
                          </div>
                        ) : (
                          <div>
                            {/* View mode header row */}
                            <div className="flex items-start gap-1.5 px-3 py-2 cursor-pointer select-none"
                              onClick={() => toggleExpandSpell(field.id)}>
                              <ChevronDownIcon className={`w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5 transition-transform ${isExpandedSpell ? '' : '-rotate-90'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                  <span className="text-stone-100 text-sm">
                                    {sp.name || <span className="text-stone-500 italic">Unnamed spell</span>}
                                  </span>
                                  {sp.ritual && <span className="text-stone-500 text-xs italic shrink-0">(ritual)</span>}
                                  {lvl > 0 && (
                                    <button type="button"
                                      onClick={e => { e.stopPropagation(); setValue(`classes.${classIndex}.spells.${i}.prepared`, !sp.prepared, { shouldDirty: true }) }}
                                      className={`text-xs px-1.5 py-0.5 rounded border shrink-0 transition-colors ${sp.prepared ? 'bg-red-900/60 text-red-300 border-red-800 hover:bg-red-900' : 'bg-transparent text-stone-600 border-stone-700 hover:text-stone-400 hover:border-stone-600'}`}>
                                      Prep
                                    </button>
                                  )}
                                  {!readOnly && (
                                    <>
                                      <button type="button" onClick={e => { e.stopPropagation(); startEditSpell(field.id) }}
                                        className="text-stone-500 hover:text-stone-300 p-1 rounded hover:bg-stone-700 shrink-0">
                                        <PencilIcon className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" onClick={e => { e.stopPropagation(); removeSpellByIndex(field.id, i) }}
                                        className="text-stone-500 hover:text-red-400 p-1 rounded hover:bg-stone-700 shrink-0">
                                        <TrashIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                                {(sp.cast_time || sp.range) && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    {sp.cast_time && <span className="text-xs text-stone-500"><span className="text-stone-600">Casting Time:</span> {sp.cast_time}</span>}
                                    {sp.range     && <span className="text-xs text-stone-500"><span className="text-stone-600">Range:</span> {sp.range}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Expanded content */}
                            {isExpandedSpell && hasExpandedContent && (
                              <div className="px-4 pb-3 border-t border-stone-700/40 pt-2 space-y-1.5">
                                {sp.school && (
                                  <p className="text-xs text-stone-400"><span className="text-stone-500">School:</span> {sp.school}</p>
                                )}
                                {compDisplay && (
                                  <p className="text-xs text-stone-400"><span className="text-stone-500">Components:</span> {compDisplay}</p>
                                )}
                                {sp.duration && (
                                  <p className="text-xs text-stone-400"><span className="text-stone-500">Duration:</span> {sp.duration}</p>
                                )}
                                {sp.description && (
                                  <p className="text-stone-300 text-sm whitespace-pre-wrap">{sp.description}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {!readOnly && (
                    <div className="px-3 py-2">
                      <button type="button" onClick={() => addSpellAtLevel(lvl)}
                        className={`text-xs flex items-center gap-0.5 ${c.text} opacity-70 hover:opacity-100`}>
                        <PlusIcon className="w-3.5 h-3.5" /> Add {lvl === 0 ? 'cantrip' : 'spell'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={!!noSlotsModal} title="No slots remaining"
        onCancel={() => setNoSlotsModal(null)}>
        No {noSlotsModal ? SPELL_LEVEL_COLORS[noSlotsModal.lvl].label.toLowerCase() : ''} slots remaining.
      </Modal>
    </div>
  )
}

function ExhaustionBlock({ watch, setValue, readOnly }) {
  const [tooltip, setTooltip] = useState(null)
  const exhaustion = watch('exhaustion') ?? 0

  return (
    <div className="bg-stone-800 border border-stone-700 rounded-lg p-3 space-y-3">
      <div className="label text-xs">Exhaustion</div>
      <div className="flex items-center gap-2 flex-wrap">
        {[1,2,3,4,5,6].map(j => {
          const isActive = exhaustion >= j
          const colors   = EXHAUSTION_DOT_COLORS[j]
          return (
            <button key={j} type="button"
              onClick={() => !readOnly && setValue('exhaustion', exhaustion >= j ? j - 1 : j, { shouldDirty: true })}
              onMouseMove={e => setTooltip({ level: j, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors text-sm ${
                isActive ? colors.on : `bg-transparent ${colors.off}`
              }`}
              disabled={readOnly}
            >
              {j === 6 && isActive && (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-400">
                  <path d="M12 2a7 7 0 0 0-7 7c0 2.56 1.37 4.8 3.42 6.03L8 17h8l-.42-1.97A7.001 7.001 0 0 0 12 2ZM9 17v1a1 1 0 0 0 1 1h1v1h2v-1h1a1 1 0 0 0 1-1v-1H9Z"/>
                </svg>
              )}
            </button>
          )
        })}
        {exhaustion > 0 && (
          <span className="text-stone-500 text-xs ml-1">Lvl {exhaustion}</span>
        )}
      </div>

      {tooltip && (
        <div className="fixed z-50 pointer-events-none max-w-xs bg-stone-900 border border-stone-600 rounded-lg px-3 py-2 shadow-xl text-xs text-stone-300 leading-relaxed"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          <div className="font-semibold text-stone-100 mb-1">Exhaustion</div>
          {EXHAUSTION_EFFECTS[tooltip.level]}
        </div>
      )}
    </div>
  )
}

function ConditionsBlock({ watch, readOnly, onToggle }) {
  const [tooltip, setTooltip] = useState(null)   // { name, x, y } for mouse tooltip
  const activeConditions            = watch('conditions') || []


  return (
    <div>
      <div className="label mb-2">Conditions</div>
      <div className="flex flex-wrap gap-2">
        {CONDITIONS.map(c => {
          const active = activeConditions.includes(c)
          return (
            <button
              key={c} type="button"
              onClick={() => onToggle(c)}
              onMouseMove={e => setTooltip({ name: c, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
              className={`px-2 py-1 rounded text-xs font-medium border transition-colors select-none ${
                active
                  ? 'bg-red-900 border-red-700 text-red-100'
                  : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-500'
              }`}
              disabled={readOnly}
            >
              {c}
            </button>
          )
        })}
      </div>

      {/* Mouse-follow tooltip (desktop only) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none max-w-xs bg-stone-900 border border-stone-600 rounded-lg px-3 py-2 shadow-xl text-xs text-stone-300 leading-relaxed"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-semibold text-stone-100 mb-1">{tooltip.name}</div>
          {CONDITION_DESC[tooltip.name]}
        </div>
      )}

    </div>
  )
}

export default function CharacterSheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isNew = !id

  const { register, control, handleSubmit, watch, reset, setValue, formState: { isDirty, isSubmitting } } = useForm({
    defaultValues: {
      name: '', race: '', background: '', alignment: '', experience_points: 0,
      classes: [],
      strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
      saving_throw_profs: [], skill_profs: [], skill_expertise: [],
      proficiency_bonus: 2, inspiration: 0,
      armor_class: 10, initiative_bonus: 0, speed: 30,
      max_hp: 0, current_hp: 0, temp_hp: 0,
      hit_dice: '', hit_dice_remaining: '',
      death_save_successes: 0, death_save_failures: 0,
      attacks: [], equipment: [],
      copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0,
      personality_traits: '', ideals: '', bonds: '', flaws: '',
      features_and_traits: '', other_proficiencies: '',
      character_backstory: '', allies_and_organizations: '',
      additional_features_and_traits: '', treasure: '',
      age: '', height: '', weight: '', eyes: '', skin: '', hair: '', appearance_notes: '',
      passive_perception: 10, conditions: [], notes: '', features_list: [], exhaustion: 0,
      speed_base: null, max_hp_base: null,
      unarmed_attack_modifier: '', unarmed_damage_roll: '',
    }
  })

  const { fields: classFields,  append: addClass,  remove: removeClass  } = useFieldArray({ control, name: 'classes' })
  const { fields: featureFields, append: addFeature, remove: removeFeature } = useFieldArray({ control, name: 'features_list' })

  const [loading, setLoading] = useState(!isNew)
  const [readOnly, setReadOnly] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [equipmentHasEditing, setEquipmentHasEditing] = useState(false)
  const [tempHpDisplayStr, setTempHpDisplayStr] = useState('')
  const autoSaveTimer = useRef(null)
  const savedValuesRef = useRef(null)
  const isInitialLoadRef   = useRef(false)
  const prevEffectStateRef = useRef(null)

const [expandedFeatures, setExpandedFeatures] = useState(new Set())
  const [expandedWeapons,  setExpandedWeapons]  = useState(new Set())
  const [unarmedEditing,   setUnarmedEditing]   = useState(false)
  const [editingFeatures, setEditingFeatures] = useState(new Set())
  const prevFeaturesLengthRef = useRef(0)
  const pendingNewFeature = useRef(false)
  const [useFeatureModal,   setUseFeatureModal]   = useState(null) // { index, name }
  const [outOfChargesModal, setOutOfChargesModal] = useState(null) // { name }

  const [editingClasses,  setEditingClasses]  = useState(new Set())
  const prevClassesLengthRef = useRef(0)
  const pendingNewClass      = useRef(false)
  const [levelUpModal,      setLevelUpModal]      = useState(null) // { index, className }
  const [deleteClassModal,  setDeleteClassModal]  = useState(null) // { index, className, isSpellcaster }

  useEffect(() => {
    if (pendingNewFeature.current && featureFields.length > prevFeaturesLengthRef.current) {
      const newId = featureFields[featureFields.length - 1].id
      setEditingFeatures(prev => new Set([...prev, newId]))
      setExpandedFeatures(prev => new Set([...prev, newId]))
      pendingNewFeature.current = false
    }
    prevFeaturesLengthRef.current = featureFields.length
  }, [featureFields.length])

  useEffect(() => {
    if (pendingNewClass.current && classFields.length > prevClassesLengthRef.current) {
      setEditingClasses(prev => new Set([...prev, classFields[classFields.length - 1].id]))
      pendingNewClass.current = false
    }
    prevClassesLengthRef.current = classFields.length
  }, [classFields.length])

  const watchedFormValues = useWatch({ control })
  const watchedJson = JSON.stringify(watchedFormValues)
  const handleSubmitRef = useRef(handleSubmit)
  const onSubmitRef = useRef(onSubmit)
  handleSubmitRef.current = handleSubmit
  onSubmitRef.current = onSubmit

  useEffect(() => {
    if (isNew || savedValuesRef.current === null) return
    if (savedValuesRef.current === watchedJson) return
    if (readOnly || editingFeatures.size > 0 || equipmentHasEditing) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      handleSubmitRef.current(onSubmitRef.current)()
    }, 1500)
    return () => clearTimeout(autoSaveTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedJson, editingFeatures.size, equipmentHasEditing])

  function toggleExpandFeature(fieldId) {
    setExpandedFeatures(prev => {
      const next = new Set(prev)
      next.has(fieldId) ? next.delete(fieldId) : next.add(fieldId)
      return next
    })
  }

  function startEditFeature(fieldId) {
    setEditingFeatures(prev => new Set([...prev, fieldId]))
    setExpandedFeatures(prev => new Set([...prev, fieldId]))
  }

  function stopEditFeature(fieldId) {
    setEditingFeatures(prev => { const n = new Set(prev); n.delete(fieldId); return n })
  }

  function handleRemoveFeature(i) {
    const fieldId = featureFields[i].id
    setEditingFeatures(prev => { const n = new Set(prev); n.delete(fieldId); return n })
    setExpandedFeatures(prev => { const n = new Set(prev); n.delete(fieldId); return n })
    removeFeature(i)
  }
  function handleUseFeature(i) {
    const curr = parseInt(watch(`features_list.${i}.charges_current`)) || 0
    const name = watch(`features_list.${i}.name`) || 'this feature'
    if (curr <= 0) { setOutOfChargesModal({ name }); return }
    setUseFeatureModal({ index: i, name })
  }
  function confirmUseFeature() {
    const { index } = useFeatureModal
    const curr = parseInt(watch(`features_list.${index}.charges_current`)) || 0
    setValue(`features_list.${index}.charges_current`, Math.max(0, curr - 1), { shouldDirty: true })
    setUseFeatureModal(null)
  }

  function startEditClass(fieldId) { setEditingClasses(prev => new Set([...prev, fieldId])) }
  function stopEditClass(fieldId)  { setEditingClasses(prev => { const n = new Set(prev); n.delete(fieldId); return n }) }
  function handleRemoveClass(i) {
    const cls = allClasses[i] || {}
    setDeleteClassModal({ index: i, className: cls.name || 'this class', isSpellcaster: !!cls.is_spellcaster, step: 1 })
  }
  function confirmRemoveClass() {
    if (deleteClassModal.step === 1) {
      setDeleteClassModal(prev => ({ ...prev, step: 2 }))
      return
    }
    const i = deleteClassModal.index
    setEditingClasses(prev => { const n = new Set(prev); n.delete(classFields[i].id); return n })
    removeClass(i)
    setDeleteClassModal(null)
  }
  function handleLevelUp(i) {
    setLevelUpModal({ index: i, className: allClasses[i]?.name || 'this class' })
  }
  function confirmLevelUp() {
    const curr = parseInt(watch(`classes.${levelUpModal.index}.level`)) || 0
    setValue(`classes.${levelUpModal.index}.level`, curr + 1, { shouldDirty: true })
    setLevelUpModal(null)
  }

  function handleConditionToggle(conditionName) {
    if (readOnly) return
    const current = watch('conditions') || []
    const isRemoving = current.includes(conditionName)
    let newConditions = isRemoving
      ? current.filter(c => c !== conditionName)
      : [...current, conditionName]
    if (!isRemoving && CONDITION_CHAINS[conditionName]) {
      for (const chained of CONDITION_CHAINS[conditionName]) {
        if (!newConditions.includes(chained)) newConditions = [...newConditions, chained]
      }
    }
    setValue('conditions', newConditions, { shouldDirty: true })
  }

  const watchedAbilities  = watch(ABILITIES)
  const watchedProfs      = watch('saving_throw_profs') || []
  const watchedSkillProfs = watch('skill_profs') || []
  const watchedSkillExp   = watch('skill_expertise') || []
  const watchedProfBonus  = watch('proficiency_bonus') ?? 0
  const allClasses        = watch('classes') || []

  const watchedMaxHp  = watch('max_hp')     ?? 0
  const watchedCurrHp = watch('current_hp') ?? 0
  const watchedTempHp = watch('temp_hp')    ?? 0
  const safeMax       = watchedMaxHp > 0 ? watchedMaxHp : 1
  const tempOverflow  = watchedTempHp >= watchedMaxHp && watchedMaxHp > 0
  const hpBarWidthPct = tempOverflow ? (watchedMaxHp / watchedTempHp) * 100 : 100
  const redFillPct    = Math.min(watchedCurrHp, watchedMaxHp) / safeMax * hpBarWidthPct
  const greenFillPct  = Math.min(watchedTempHp / safeMax, 1) * 100

  const autoInitBonus = mod(watchedAbilities[1] ?? 10)

  const charStats = {
    strength: watchedAbilities[0], dexterity: watchedAbilities[1],
    constitution: watchedAbilities[2], intelligence: watchedAbilities[3],
    wisdom: watchedAbilities[4], charisma: watchedAbilities[5],
    proficiency_bonus: watchedProfBonus
  }

  const autoAC = (() => {
    const equipped = (watch('equipment') || []).filter(i => i.type === 'armor' && i.equipped)
    const body = equipped.filter(i => i.armor_category !== 'shield')
    const shields = equipped.filter(i => i.armor_category === 'shield')
    let base = 10
    if (body.length > 0) {
      const acs = body.map(i => parseFloat(evalFormula(i.ac_formula, charStats)) || 0)
      base = Math.max(...acs)
    }
    const shieldBonus = shields.reduce((sum, i) => sum + (parseFloat(evalFormula(i.ac_formula, charStats)) || 0), 0)
    return base + shieldBonus
  })()

  const watchedHdRemaining    = watch('hit_dice_remaining') || ''
  const watchedDeathSuccesses = watch('death_save_successes') ?? 0
  const watchedDeathFailures  = watch('death_save_failures')  ?? 0
  const computedHitDice       = computeHitDice(allClasses)
  const remainingDice         = parseHitDice(watchedHdRemaining)
  const activeConditions      = watch('conditions') || []
  const watchedExhaustion     = watch('exhaustion') ?? 0

  function useHitDieOfSize(size) {
    const updated = remainingDice.map(d => d.size === size ? { ...d, count: d.count - 1 } : d).filter(d => d.count > 0)
    setValue('hit_dice_remaining', updated.length ? stringifyHitDice(updated) : '0', { shouldDirty: true })
  }

  // Normalize trailing/leading zeros in any number input across the sheet
  useEffect(() => {
    function normalizeNumber(e) {
      const el = e.target
      if (el.tagName !== 'INPUT' || el.type !== 'number' || !el.name) return
      if (el.value === '' || el.value === '-') return
      const n = parseFloat(el.value)
      if (isNaN(n)) return
      const normalized = String(n)
      if (el.value !== normalized) setValue(el.name, n, { shouldDirty: true })
    }
    document.addEventListener('blur', normalizeNumber, true)
    return () => document.removeEventListener('blur', normalizeNumber, true)
  }, [setValue])

  // Auto-calculate proficiency bonus: 2 + floor((totalLevel - 1) / 4)
  useEffect(() => {
    const total = allClasses.reduce((sum, cls) => sum + (parseInt(cls.level) || 0), 0)
    const bonus = total > 0 ? 2 + Math.floor((total - 1) / 4) : 0
    setValue('proficiency_bonus', bonus)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allClasses.map(c => c.level))])

  // Auto-sync hit_dice from class levels/hit_die; seed hit_dice_remaining when empty
  useEffect(() => {
    const computed = computeHitDice(allClasses)
    setValue('hit_dice', computed)
    const remaining = watch('hit_dice_remaining')
    if (!remaining || remaining === '') setValue('hit_dice_remaining', computed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allClasses.map(c => [c.level, c.hit_die]))])

  // Apply condition & exhaustion side-effects (speed, max HP)
  useEffect(() => {
    const prev = prevEffectStateRef.current
    prevEffectStateRef.current = { conditions: activeConditions, exhaustion: watchedExhaustion }
    if (prev === null) return                                               // skip mount with defaults
    if (isInitialLoadRef.current) { isInitialLoadRef.current = false; return } // skip data-load reset

    // --- Speed effects ---
    const currSpeed   = watch('speed')
    const speedBase   = watch('speed_base') ?? null  // null = no condition was active
    const hasSpeedFx  = activeConditions.some(c => SPEED_ZERO_CONDITIONS.has(c)) || watchedExhaustion >= 2

    if (hasSpeedFx) {
      if (speedBase == null) {
        // First activation: save current speed as base, then apply effect
        setValue('speed_base', currSpeed, { shouldDirty: true })
        const target = computeEffectiveSpeed(currSpeed, activeConditions, watchedExhaustion)
        if (target !== currSpeed) setValue('speed', target, { shouldDirty: true })
      } else {
        // Already have a base: recompute target from it
        const target = computeEffectiveSpeed(speedBase, activeConditions, watchedExhaustion)
        if (target !== currSpeed) setValue('speed', target, { shouldDirty: true })
      }
    } else if (speedBase != null) {
      // All speed effects just cleared: detect manual changes via prev state
      const prevExpected = computeEffectiveSpeed(speedBase, prev.conditions, prev.exhaustion)
      if (currSpeed !== prevExpected) {
        // Speed was manually changed while a condition was active → keep it, just clear base
        setValue('speed_base', null, { shouldDirty: true })
      } else {
        setValue('speed', speedBase, { shouldDirty: true })
        setValue('speed_base', null, { shouldDirty: true })
      }
    }

    // --- Max HP effects (exhaustion level 4 → halved) ---
    const currMaxHp = watch('max_hp')
    const hpBase    = watch('max_hp_base') ?? null

    if (watchedExhaustion >= 4) {
      if (hpBase == null) {
        setValue('max_hp_base', currMaxHp, { shouldDirty: true })
        const target = Math.max(1, Math.floor(currMaxHp / 2))
        if (target !== currMaxHp) {
          setValue('max_hp', target, { shouldDirty: true })
          const currHp = watch('current_hp')
          if (currHp > target) setValue('current_hp', target, { shouldDirty: true })
        }
      } else {
        const target = Math.max(1, Math.floor(hpBase / 2))
        if (target !== currMaxHp) {
          setValue('max_hp', target, { shouldDirty: true })
          const currHp = watch('current_hp')
          if (currHp > target) setValue('current_hp', target, { shouldDirty: true })
        }
      }
    } else if (hpBase != null) {
      const prevExpected = prev.exhaustion >= 4 ? Math.max(1, Math.floor(hpBase / 2)) : hpBase
      if (currMaxHp !== prevExpected) {
        setValue('max_hp_base', null, { shouldDirty: true })
      } else {
        setValue('max_hp', hpBase, { shouldDirty: true })
        setValue('max_hp_base', null, { shouldDirty: true })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(activeConditions), watchedExhaustion])

  useEffect(() => {
    if (isNew) return
    api.get(`/characters/${id}`)
      .then(r => {
        const data = r.data
        // flatten spell_slots to form-friendly shape
        isInitialLoadRef.current = true
        reset(data)
        savedValuesRef.current = JSON.stringify(data)
        setTempHpDisplayStr(data.temp_hp > 0 ? String(data.temp_hp) : '')
        if (data.owner_id !== user.id) setReadOnly(true)
      })
      .catch(() => navigate('/characters'))
      .finally(() => setLoading(false))
  }, [id])

  const getAbilityMod = useCallback((ability) => {
    const idx = ABILITIES.indexOf(ability)
    return mod(watchedAbilities[idx] || 10)
  }, [watchedAbilities])

  const getSavingThrow = useCallback((ability) => {
    const base = getAbilityMod(ability)
    const proficient = watchedProfs.includes(ability)
    return base + (proficient ? watchedProfBonus : 0)
  }, [getAbilityMod, watchedProfs, watchedProfBonus])

  const getSkillBonus = useCallback((skill) => {
    const base = getAbilityMod(skill.ability)
    const proficient = watchedSkillProfs.includes(skill.name)
    const expert = watchedSkillExp.includes(skill.name)
    return base + (expert ? watchedProfBonus * 2 : proficient ? watchedProfBonus : 0)
  }, [getAbilityMod, watchedSkillProfs, watchedSkillExp, watchedProfBonus])

  function toggleArrayValue(fieldName, value) {
    const current = watch(fieldName) || []
    if (current.includes(value)) {
      setValue(fieldName, current.filter(v => v !== value), { shouldDirty: true })
    } else {
      setValue(fieldName, [...current, value], { shouldDirty: true })
    }
  }

  async function onSubmit(data) {
    setError('')
    try {
      if (isNew) {
        const res = await api.post('/characters', data)
        navigate(`/characters/${res.data.id}`, { replace: true })
      } else {
        await api.put(`/characters/${id}`, data)
        savedValuesRef.current = JSON.stringify(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    }
  }

  if (loading) return <div className="text-stone-400">Loading…</div>

  const watchName = watch('name')

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-stone-100">
          {watchName || (isNew ? 'New Character' : 'Character Sheet')}
        </h1>
        <div className="flex items-center gap-2">
          {error && <span className="text-red-400 text-sm">{error}</span>}
          {!readOnly && (
            <button type="submit" disabled={isSubmitting}
              className={`btn ${saved ? 'bg-green-700 border-green-600 text-white hover:bg-green-600' : 'btn-primary'}`}>
              {isSubmitting ? 'Saving…' : saved ? 'Saved!' : isNew ? 'Create' : 'Save'}
            </button>
          )}
          <button type="button" onClick={() => navigate('/characters')} className="btn btn-secondary">
            Back
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information">
        {/* Row 1 on desktop: Name · Race · Background · Alignment
            Mobile: Name+Race on row 1, Background+Alignment on row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="label">Character Name</label>
            <input {...register('name')} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Race</label>
            <input {...register('race')} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Background</label>
            <input {...register('background')} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Alignment</label>
            <select {...register('alignment')} className="input" disabled={readOnly}>
              <option value="">—</option>
              {ALIGNMENTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Classes list */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="label">Classes</span>
            {!readOnly && (
              <button type="button"
                onClick={() => { pendingNewClass.current = true; addClass({ name: '', subclass: '', level: 1, hit_die: '', is_spellcaster: false, casting_ability: '', spell_slots: {}, spells: [] }) }}
                className="btn btn-secondary btn-sm py-0.5 text-xs">
                <PlusIcon className="w-3 h-3 mr-1" /> Add Class
              </button>
            )}
          </div>
          <div className="space-y-1">
            {classFields.length === 0 && <p className="text-stone-600 text-xs italic px-1">No classes added.</p>}
            {classFields.map((field, i) => {
              const isEditing = editingClasses.has(field.id)
              const cls = allClasses[i] || {}
              return (
                <div key={field.id} className="bg-stone-800 border border-stone-700 rounded-lg overflow-hidden">
                  {isEditing && !readOnly ? (
                    <div className="p-2 space-y-2">
                      <div className="flex gap-2 flex-wrap items-center">
                        <input {...register(`classes.${i}.name`)} className="input flex-1 min-w-28" placeholder="Class name" autoFocus={!cls.name} />
                        <input {...register(`classes.${i}.subclass`)} className="input flex-1 min-w-28" placeholder="Subclass (optional)" />
                        <input type="number" min={1} max={20} {...register(`classes.${i}.level`, { valueAsNumber: true })} className="input w-16" placeholder="Lvl" />
                        <select {...register(`classes.${i}.hit_die`)} className="input w-20">
                          <option value="">HD</option>
                          {HD_DIE_SIZES.map(n => <option key={n} value={`d${n}`}>d{n}</option>)}
                        </select>
                        <button type="button" onClick={() => stopEditClass(field.id)}
                          className="text-green-400 hover:text-green-300 p-1.5 rounded hover:bg-stone-700 shrink-0">
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleRemoveClass(i)}
                          className="text-stone-500 hover:text-red-400 p-1.5 rounded hover:bg-stone-700 shrink-0">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 text-sm text-stone-400 cursor-pointer select-none">
                          <input type="checkbox" {...register(`classes.${i}.is_spellcaster`)} className="accent-red-700 w-4 h-4" />
                          Spellcaster
                        </label>
                        {cls.is_spellcaster && (
                          <select {...register(`classes.${i}.casting_ability`)} className="input w-40">
                            <option value="">— casting ability —</option>
                            {ABILITIES.map(a => <option key={a} value={a}>{ABILITY_SHORT[a]} — {a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="flex-1 text-stone-100 text-sm font-medium truncate min-w-0">
                        {cls.name || <span className="text-stone-500 italic">Unnamed class</span>}
                        {cls.subclass && <span className="text-stone-400 font-normal"> / {cls.subclass}</span>}
                      </span>
                      {cls.is_spellcaster && cls.casting_ability && (
                        <span className="flex items-center gap-0.5 text-xs text-yellow-400 shrink-0">
                          <SparklesIcon className="w-3.5 h-3.5" />{ABILITY_SHORT[cls.casting_ability]}
                        </span>
                      )}
                      {!readOnly && (
                        <button type="button" onClick={() => handleLevelUp(i)}
                          className="btn btn-secondary btn-sm py-0.5 px-2 text-xs shrink-0 text-emerald-300 border-emerald-800 hover:bg-emerald-900/40">
                          Level Up!
                        </button>
                      )}
                      {cls.hit_die && (
                        <span className="text-xs text-stone-500 shrink-0">{cls.hit_die}</span>
                      )}
                      {cls.level > 0 && (
                        <span className="text-xs bg-stone-700 text-stone-300 px-2 py-0.5 rounded shrink-0">Lv. {cls.level}</span>
                      )}
                      {!readOnly && (
                        <>
                          <button type="button" onClick={() => startEditClass(field.id)}
                            className="text-stone-500 hover:text-stone-300 p-1 rounded hover:bg-stone-700 shrink-0">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleRemoveClass(i)}
                            className="text-stone-500 hover:text-red-400 p-1 rounded hover:bg-stone-700 shrink-0">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Secondary stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="stat-box">
            <div className="label text-xs text-center">Experience Points</div>
            <input type="number" min={0} {...register('experience_points', { valueAsNumber: true })}
              className="input text-center text-xl font-bold p-1 no-spinner" disabled={readOnly} />
          </div>
          <div className="stat-box">
            <div className="label text-xs text-center">Proficiency Bonus</div>
            <div className="text-xl font-bold text-center text-stone-100 py-0.5">+{watchedProfBonus}</div>
            <input type="hidden" {...register('proficiency_bonus', { valueAsNumber: true })} />
          </div>
          <div className="stat-box">
            <div className="label text-xs text-center">Inspiration</div>
            <input type="number" min={0} {...register('inspiration', { valueAsNumber: true })}
              className="input text-center text-xl font-bold p-1 no-spinner" disabled={readOnly} />
          </div>
        </div>
      </Section>

      {/* Ability Scores & Derived */}
      <Section title="Ability Scores">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          {ABILITIES.map((ability, i) => (
            <div key={ability} className="stat-box">
              <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">{ABILITY_SHORT[ability]}</div>
              <input
                type="number" min={1} max={30}
                {...register(ability, { valueAsNumber: true })}
                className="input text-center text-xl font-bold p-1 mb-1"
                disabled={readOnly}
              />
              <div className="text-stone-300 text-sm font-medium">{fmtMod(mod(watchedAbilities[i] || 10))}</div>
            </div>
          ))}
        </div>

        {/* Saving Throws + Passive Perception */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="label mb-2">Saving Throws</div>
            <div className="space-y-1">
              {ABILITIES.map(ability => (
                <label key={ability} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={watchedProfs.includes(ability)}
                    onChange={() => !readOnly && toggleArrayValue('saving_throw_profs', ability)}
                    className="rounded accent-red-700"
                    disabled={readOnly}
                  />
                  <span className="text-stone-300 text-sm flex-1">{ABILITY_SHORT[ability]}</span>
                  <span className="text-stone-400 text-sm w-8 text-right">{fmtMod(getSavingThrow(ability))}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Passive Perception</div>
            <input type="number" {...register('passive_perception', { valueAsNumber: true })}
              className="input w-24" disabled={readOnly} />
          </div>
        </div>

        {/* Skills */}
        <div className="border-t border-stone-700 pt-3">
          <div className="label mb-2">Skills <span className="font-normal text-stone-500 text-xs">(🔴 proficient · 🟡 expertise)</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {SKILLS.map(skill => {
              const isProficient = watchedSkillProfs.includes(skill.name)
              const isExpert = watchedSkillExp.includes(skill.name)
              return (
                <label key={skill.name} className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={isProficient}
                    onChange={() => {
                      if (readOnly) return
                      if (isProficient && isExpert) {
                        toggleArrayValue('skill_expertise', skill.name)
                        toggleArrayValue('skill_profs', skill.name)
                      } else {
                        toggleArrayValue('skill_profs', skill.name)
                      }
                    }}
                    className="rounded accent-red-700"
                    disabled={readOnly}
                  />
                  <input
                    type="checkbox"
                    checked={isExpert}
                    onChange={() => !readOnly && toggleArrayValue('skill_expertise', skill.name)}
                    className="rounded accent-yellow-600"
                    title="Expertise"
                    disabled={readOnly}
                  />
                  <span className="text-stone-300 text-sm flex-1">{skill.name}</span>
                  <span className="text-xs text-stone-500">{ABILITY_SHORT[skill.ability]}</span>
                  <span className="text-stone-300 text-sm w-8 text-right">{fmtMod(getSkillBonus(skill))}</span>
                </label>
              )
            })}
          </div>
        </div>
      </Section>

      {/* Combat */}
      <Section title="Combat">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">

          {/* HP + Temp HP bars */}
          <div className="flex flex-col gap-1">
            {/* HP Bar */}
            <div className="relative h-12 rounded-lg overflow-hidden bg-stone-900">
              <div className="absolute inset-y-0 left-0 bg-red-700 transition-all duration-200 rounded-lg"
                style={{ width: `${redFillPct}%` }} />
              <div className="absolute inset-0 flex items-center justify-center gap-1 z-10">
                <span className="text-red-200 font-semibold text-sm select-none">HP</span>
                <input type="number"
                  {...register('current_hp', {
                    valueAsNumber: true,
                    onChange: e => {
                      const raw = e.target.value
                      if (raw === '') { setValue('current_hp', 0, { shouldDirty: true }); return }
                      const val = parseInt(raw)
                      const max = parseInt(watch('max_hp')) || 0
                      if (isNaN(val) || val < 0) setValue('current_hp', 0, { shouldDirty: true })
                      else if (val > max) setValue('current_hp', max, { shouldDirty: true })
                    }
                  })}
                  className="no-spinner bg-transparent text-stone-100 font-bold text-lg text-right w-12 focus:outline-none font-sans"
                  disabled={readOnly} />
                <span className="text-stone-400 font-bold text-lg select-none">/</span>
                <input type="number"
                  {...register('max_hp', {
                    valueAsNumber: true,
                    onChange: e => {
                      const raw = e.target.value
                      if (raw === '') { setValue('max_hp', 0, { shouldDirty: true }); setValue('current_hp', 0, { shouldDirty: true }); return }
                      const newMax = parseInt(raw) || 0
                      const curr = parseInt(watch('current_hp')) || 0
                      if (curr > newMax) setValue('current_hp', newMax, { shouldDirty: true })
                    }
                  })}
                  className="no-spinner bg-transparent text-stone-100 font-bold text-lg text-left w-12 focus:outline-none font-sans"
                  disabled={readOnly} />
              </div>
            </div>

            {/* Temp HP Bar */}
            <div className="relative h-10 rounded overflow-hidden bg-stone-900">
              <div className="absolute inset-y-0 left-0 bg-green-700 transition-all duration-200 rounded"
                style={{ width: `${greenFillPct}%` }} />
              <div className="absolute inset-0 flex items-center justify-center gap-1 z-10">
                {tempHpDisplayStr !== '' && (
                  <span className="text-green-200 font-semibold text-xs select-none">Temp HP</span>
                )}
                <input type="number"
                  value={tempHpDisplayStr}
                  placeholder={tempHpDisplayStr === '' ? 'Temp HP' : ''}
                  onChange={e => {
                    const str = e.target.value
                    if (str === '') {
                      setTempHpDisplayStr('')
                      setValue('temp_hp', 0, { shouldDirty: true })
                    } else {
                      const val = Math.max(0, parseInt(str) || 0)
                      setTempHpDisplayStr(String(val))
                      setValue('temp_hp', val, { shouldDirty: true })
                    }
                  }}
                  className="no-spinner bg-transparent text-stone-100 text-sm font-bold text-center w-16 focus:outline-none font-sans placeholder:text-stone-500"
                  disabled={readOnly} />
              </div>
            </div>
          </div>

          {/* AC / Speed / Initiative */}
          <div className="flex items-stretch gap-2">

            {/* AC — Shield, height-driven from siblings */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative" style={{ height: '100%', aspectRatio: '76 / 86' }}>
                <svg viewBox="0 0 76 86" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4,4 L72,4 L72,46 L38,82 L4,46 Z"
                    fill="#292524" stroke="#57534e" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ paddingBottom: '20%' }}>
                  <span className="label text-xs text-center select-none">AC</span>
                  <input type="number"
                    {...register('armor_class', {
                      valueAsNumber: true,
                      onBlur: e => {
                        if (e.target.value === '') setValue('armor_class', autoAC, { shouldDirty: true })
                      }
                    })}
                    placeholder={String(autoAC)}
                    className="no-spinner bg-transparent text-stone-100 font-bold text-2xl text-center w-12 focus:outline-none font-sans placeholder:text-stone-500"
                    disabled={readOnly} />
                </div>
              </div>
            </div>

            {/* Speed */}
            <div className="flex-1 stat-box flex flex-col items-center justify-center">
              <div className="label text-xs text-center whitespace-nowrap">🥾 Speed 🥾</div>
              <input type="number"
                {...register('speed', { valueAsNumber: true })}
                className="no-spinner bg-transparent border-0 text-center w-full p-0 text-lg font-bold focus:outline-none text-stone-100 font-sans mt-1"
                disabled={readOnly} />
            </div>

            {/* Initiative */}
            <div className="flex-1 stat-box flex flex-col items-center justify-center">
              <div className="label text-xs text-center">Initiative</div>
              <input type="number"
                {...register('initiative_bonus', {
                  valueAsNumber: true,
                  onBlur: e => {
                    if (e.target.value === '') setValue('initiative_bonus', autoInitBonus, { shouldDirty: true })
                  }
                })}
                placeholder={autoInitBonus >= 0 ? `+${autoInitBonus}` : String(autoInitBonus)}
                className="no-spinner bg-transparent border-0 text-center w-full p-0 text-lg font-bold focus:outline-none text-stone-100 font-sans mt-1 placeholder:text-stone-500"
                disabled={readOnly} />
            </div>

          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">

          {/* Hit Dice block */}
          <div className="bg-stone-800 border border-stone-700 rounded-lg p-3 space-y-2">
            <div className="label text-xs">Hit Dice</div>
            <div className="flex items-baseline gap-1.5 text-sm">
              <span className="text-stone-400 text-xs shrink-0">Total:</span>
              <span className="text-stone-100 font-semibold">{computedHitDice || <span className="text-stone-600 italic">—</span>}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-stone-400 text-xs shrink-0">Remaining:</span>
              <input
                {...register('hit_dice_remaining', {
                  onBlur: e => {
                    const cleaned = cleanHitDiceInput(e.target.value)
                    const val = cleaned || computedHitDice
                    setValue('hit_dice_remaining', val, { shouldDirty: true })
                  }
                })}
                className="input text-sm py-0.5 flex-1 min-w-0"
                placeholder={computedHitDice || 'e.g. 3d8'}
                disabled={readOnly}
              />
            </div>
            {!readOnly && remainingDice.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {remainingDice.map(({ count, size }) => (
                  <button key={size} type="button"
                    onClick={() => useHitDieOfSize(size)}
                    className="btn btn-secondary btn-sm text-xs py-0.5 px-2">
                    Use d{size} <span className="text-stone-500 ml-1">({count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Death Saving Throws block */}
          <div className="bg-stone-800 border border-stone-700 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="label text-xs">Death Saving Throws</div>
              {!readOnly && (() => {
                const hasMarks = watchedDeathSuccesses > 0 || watchedDeathFailures > 0
                return (
                  <button type="button"
                    onClick={() => { if (hasMarks) { setValue('death_save_successes', 0, { shouldDirty: true }); setValue('death_save_failures', 0, { shouldDirty: true }) } }}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${hasMarks ? 'border-fuchsia-600 text-fuchsia-400 hover:bg-fuchsia-900/30 cursor-pointer' : 'border-stone-700 text-stone-600 cursor-default'}`}>
                    Reset
                  </button>
                )
              })()}
            </div>
            {[
              { label: 'Successes', field: 'death_save_successes', watched: watchedDeathSuccesses, activeClass: 'bg-green-500 border-green-400' },
              { label: 'Failures',  field: 'death_save_failures',  watched: watchedDeathFailures,  activeClass: 'bg-red-500 border-red-400' },
            ].map(({ label, field, watched, activeClass }) => (
              <div key={field} className="flex items-center gap-3">
                <span className="text-stone-400 text-xs w-16 shrink-0">{label}</span>
                <div className="flex gap-2">
                  {[1, 2, 3].map(j => (
                    <button key={j} type="button"
                      onClick={() => !readOnly && setValue(field, watched >= j ? j - 1 : j, { shouldDirty: true })}
                      className={`w-6 h-6 rounded-full border-2 transition-colors ${
                        watched >= j ? activeClass : 'bg-transparent border-stone-600 hover:border-stone-400'
                      }`}
                      disabled={readOnly}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Exhaustion block */}
          <ExhaustionBlock watch={watch} setValue={setValue} readOnly={readOnly} />

        </div>

        {/* Conditions */}
        <ConditionsBlock
          watch={watch}
          readOnly={readOnly}
          onToggle={handleConditionToggle}
        />
      </Section>

      {/* Attacks */}
      <Section title="Attacks & Spellcasting" defaultOpen={false}>
        {(() => {
          const allEquipment = watch('equipment') || []
          const weapons = allEquipment.map((item, i) => ({ item, i })).filter(({ item }) => item.type === 'weapon')

          if (weapons.length === 0) {
            return <p className="text-stone-500 text-xs italic px-1">No weapons in equipment.</p>
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-stone-400 text-xs uppercase tracking-wide border-b border-stone-700">
                    <th className="pb-2 pr-3 w-5"></th>
                    <th className="pb-2 pr-3 text-left font-medium">Name</th>
                    <th className="pb-2 pr-3 text-center font-medium">Attack</th>
                    <th className="pb-2 pr-3 text-center font-medium">Damage</th>
                    <th className="pb-2 text-center font-medium">Charges</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Unarmed Strike — constant, unremovable, editable */}
                  {(() => {
                    const unarmedAtk = watch('unarmed_attack_modifier') || ''
                    const unarmedDmg = watch('unarmed_damage_roll') || ''
                    const atkValue   = evalFormula(unarmedAtk || 'STR+prof', charStats)
                    const dmgValue   = evalFormula(unarmedDmg || '1+STR',    charStats)
                    return (
                      <tr className="border-b border-stone-700 bg-stone-900/40">
                        <td className="py-2 pr-2">
                          {!readOnly && (
                            <button type="button" onClick={() => setUnarmedEditing(v => !v)}
                              className={`transition-colors ${unarmedEditing ? 'text-green-400 hover:text-green-300' : 'text-stone-500 hover:text-stone-300'}`}>
                              {unarmedEditing ? <CheckIcon className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="text-stone-300 font-medium text-sm">Unarmed Strike</span>
                        </td>
                        <td className="py-2 pr-3 text-center">
                          {unarmedEditing && !readOnly
                            ? <input {...register('unarmed_attack_modifier')} className="bg-transparent border-b border-stone-500 focus:border-stone-300 focus:outline-none text-center text-sm w-28 text-stone-100 py-0 leading-none" placeholder="STR+prof" />
                            : <span className="text-stone-100 font-bold text-base tabular-nums">{atkValue}</span>}
                        </td>
                        <td className="py-2 pr-3 text-center">
                          {unarmedEditing && !readOnly
                            ? <input {...register('unarmed_damage_roll')} className="bg-transparent border-b border-stone-500 focus:border-stone-300 focus:outline-none text-center text-sm w-28 text-stone-100 py-0 leading-none" placeholder="1+STR" />
                            : <span className="text-stone-100 font-bold text-base">{dmgValue}</span>}
                        </td>
                        <td className="py-2 text-center">
                          <span className="text-stone-600">—</span>
                        </td>
                      </tr>
                    )
                  })()}

                  {weapons.map(({ item, i }) => {
                    const rangeProp  = (item.properties || []).find(p => p.name === 'Ammunition' || p.name === 'Thrown')
                    const range      = rangeProp?.extra || null
                    const atkFormula = item.finesse_active && item.finesse_attack_modifier ? item.finesse_attack_modifier : item.attack_modifier
                    const versatile  = (item.properties || []).find(p => p.name === 'Versatile')
                    const dmgFormula = item.versatile_active && versatile?.extra ? versatile.extra : (item.finesse_active && item.finesse_damage_roll ? item.finesse_damage_roll : item.damage_roll)
                    const atkValue   = atkFormula ? evalFormula(atkFormula, charStats) : '—'
                    const dmgValue   = dmgFormula ? evalFormula(dmgFormula, charStats) : '—'
                    const isExpanded = expandedWeapons.has(i)
                    const props      = item.properties || []

                    return (
                      <Fragment key={i}>
                        <tr className="cursor-pointer select-none hover:bg-stone-800/40 transition-colors border-b border-stone-800"
                          onClick={() => setExpandedWeapons(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })}>
                          <td className="py-2 pr-2">
                            <ChevronDownIcon className={`w-4 h-4 text-stone-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                          </td>
                          <td className="py-2 pr-3">
                            <span className="text-stone-100 font-medium">{item.name || <span className="text-stone-500 italic">Unnamed</span>}</span>
                            {range && <span className="text-stone-400 text-xs ml-1.5">({range})</span>}
                          </td>
                          <td className="py-2 pr-3 text-center">
                            <span className="text-stone-100 font-bold text-base tabular-nums">{atkValue}</span>
                          </td>
                          <td className="py-2 pr-3 text-center">
                            <span className="text-stone-100 font-bold text-base">{dmgValue}</span>
                          </td>
                          <td className="py-2 text-center" onClick={e => e.stopPropagation()}>
                            {item.has_charges ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-stone-400 tabular-nums text-xs">{item.charges_current ?? 0}/{item.charges_max ?? 0}</span>
                                {!readOnly && (
                                  <button type="button"
                                    onClick={() => {
                                      const curr = parseInt(watch(`equipment.${i}.charges_current`)) || 0
                                      if (curr <= 0) { setOutOfChargesModal({ name: item.name || 'this weapon' }); return }
                                      setValue(`equipment.${i}.charges_current`, curr - 1, { shouldDirty: true })
                                    }}
                                    className="btn btn-secondary btn-sm py-0.5 px-2 text-xs text-purple-300 border-purple-800 hover:bg-purple-900/40">
                                    Use
                                  </button>
                                )}
                              </div>
                            ) : <span className="text-stone-600">—</span>}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="pb-3 pt-1 px-1">
                              <div className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 space-y-2">
                                <div className="flex flex-wrap gap-2 items-center">
                                  {(item.weapon_class || item.weapon_type) && (
                                    <span className="text-xs bg-red-950 text-red-300 border border-red-900 px-2 py-0.5 rounded">
                                      {item.weapon_class
                                        ? `${item.weapon_class === 'simple' ? 'Simple' : 'Martial'} ${item.weapon_range === 'ranged' ? 'Ranged' : 'Melee'}`
                                        : WEAPON_TYPES[item.weapon_type]}
                                    </span>
                                  )}
                                  {item.weapon_specific && (
                                    <span className="text-xs bg-stone-700 text-stone-300 border border-stone-600 px-2 py-0.5 rounded">
                                      {item.weapon_specific}
                                    </span>
                                  )}
                                </div>
                                {props.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {props.map(p => {
                                      if (p.name === 'Finesse') return (
                                        <button key={p.name} type="button"
                                          onClick={() => !readOnly && setValue(`equipment.${i}.finesse_active`, !item.finesse_active, { shouldDirty: true })}
                                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${item.finesse_active ? 'bg-green-900 text-green-300 border-green-700' : 'bg-stone-700 text-stone-300 border-stone-600'} ${readOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}>
                                          {p.extra ? `Finesse (${p.extra})` : 'Finesse'}
                                        </button>
                                      )
                                      if (p.name === 'Versatile') return (
                                        <button key={p.name} type="button"
                                          onClick={() => !readOnly && setValue(`equipment.${i}.versatile_active`, !item.versatile_active, { shouldDirty: true })}
                                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${item.versatile_active ? 'bg-green-900 text-green-300 border-green-700' : 'bg-stone-700 text-stone-300 border-stone-600'} ${readOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}>
                                          {p.extra ? `Versatile (${p.extra})` : 'Versatile'}
                                        </button>
                                      )
                                      return (
                                        <span key={p.name} className="text-xs bg-stone-700 text-stone-300 px-2 py-0.5 rounded">
                                          {p.extra ? `${p.name} (${p.extra})` : p.name}
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}
                                {item.description
                                  ? <p className="text-stone-300 text-sm whitespace-pre-wrap">{item.description}</p>
                                  : <p className="text-stone-500 text-sm italic">No description.</p>
                                }
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}

        {/* Per-class spellcasting */}
        {allClasses.map((cls, classIndex) => {
          if (!cls?.is_spellcaster || !cls?.casting_ability) return null
          return (
            <AttacksSpellcastingBlock
              key={classIndex}
              classIndex={classIndex}
              className={cls.name}
              castingAbility={cls.casting_ability}
              control={control}
              watch={watch}
              setValue={setValue}
              watchedProfBonus={watchedProfBonus}
              watchedAbilities={watchedAbilities}
            />
          )
        })}
      </Section>

      {/* Features */}
      <Section title="Features" defaultOpen={false}>
        <div className="space-y-1 mb-2">
          {featureFields.map((field, i) => {
            const isExpanded        = expandedFeatures.has(field.id)
            const isEditing         = editingFeatures.has(field.id)
            const featName          = watch(`features_list.${i}.name`)
            const featSource        = watch(`features_list.${i}.source`)
            const featDesc          = watch(`features_list.${i}.description`)
            const featHasCharges    = watch(`features_list.${i}.has_charges`)
            const featChargesCur    = watch(`features_list.${i}.charges_current`)
            const featChargesMax    = watch(`features_list.${i}.charges_max`)
            const featChargesRech   = watch(`features_list.${i}.charges_recharge`)
            const rechLabel = featChargesRech === 'short' ? 'Short Rest' : featChargesRech === 'long' ? 'Long Rest' : null
            return (
              <div key={field.id} className="bg-stone-800 border border-stone-700 rounded-lg overflow-hidden">
                {isEditing && !readOnly ? (
                  <div className="p-2 space-y-2">
                    {/* Name + Source + action buttons */}
                    <div className="flex gap-2 flex-wrap items-center">
                      <input {...register(`features_list.${i}.name`)} className="input flex-1 min-w-32" placeholder="Feature name" autoFocus={!featName} />
                      <input {...register(`features_list.${i}.source`)} className="input w-36" placeholder="Source (e.g. Fighter 2)" />
                      <button type="button" onClick={() => stopEditFeature(field.id)}
                        className="text-green-400 hover:text-green-300 p-1.5 rounded hover:bg-stone-700 shrink-0" title="Done editing">
                        <CheckIcon className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleRemoveFeature(i)}
                        className="text-stone-500 hover:text-red-400 p-1.5 rounded hover:bg-stone-700 shrink-0">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Charges */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-1.5 text-sm text-stone-400 cursor-pointer select-none">
                        <input type="checkbox" {...register(`features_list.${i}.has_charges`)} className="accent-red-700 w-4 h-4" />
                        Has charges
                      </label>
                      {featHasCharges && (
                        <>
                          <div className="flex items-center gap-1 text-stone-400 text-sm">
                            <input type="number" min={0}
                              {...register(`features_list.${i}.charges_current`, {
                                valueAsNumber: true,
                                onChange: e => {
                                  const max = parseInt(watch(`features_list.${i}.charges_max`)) || 0
                                  const val = parseInt(e.target.value) || 0
                                  if (val > max) setValue(`features_list.${i}.charges_current`, max, { shouldDirty: true })
                                }
                              })}
                              className="input w-16 text-center" placeholder="0" />
                            <span>/</span>
                            <input type="number" min={1}
                              {...register(`features_list.${i}.charges_max`, {
                                valueAsNumber: true,
                                onChange: e => {
                                  const max = parseInt(e.target.value) || 0
                                  const cur = parseInt(watch(`features_list.${i}.charges_current`)) || 0
                                  if (cur > max) setValue(`features_list.${i}.charges_current`, max, { shouldDirty: true })
                                }
                              })}
                              className="input w-16 text-center" placeholder="1" />
                          </div>
                          <select {...register(`features_list.${i}.charges_recharge`)} className="input w-36">
                            <option value="">— recharge —</option>
                            <option value="short">Short Rest</option>
                            <option value="long">Long Rest</option>
                          </select>
                        </>
                      )}
                    </div>
                    {/* Description */}
                    <textarea {...register(`features_list.${i}.description`)} className="input w-full resize-none"
                      rows={3} placeholder="Description (optional)" style={{ whiteSpace: 'pre-wrap' }} />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none"
                      onClick={() => toggleExpandFeature(field.id)}>
                      <ChevronDownIcon className={`w-4 h-4 text-stone-500 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <span className="text-stone-100 text-sm font-medium truncate min-w-0">
                          {featName || <span className="text-stone-500 italic">Unnamed feature</span>}
                        </span>
                        {featSource && (
                          <span className="text-stone-500 text-xs shrink-0">({featSource})</span>
                        )}
                      </div>
                      {featHasCharges && (
                        <span className="text-stone-400 text-xs shrink-0">{featChargesCur ?? 0}/{featChargesMax ?? 0}</span>
                      )}
                      {featHasCharges && rechLabel && (
                        <span className="text-stone-500 text-xs shrink-0">({rechLabel})</span>
                      )}
                      {featHasCharges && !readOnly && (
                        <button type="button"
                          onClick={e => { e.stopPropagation(); handleUseFeature(i) }}
                          className="btn btn-secondary btn-sm py-0.5 px-2 text-xs shrink-0 text-purple-300 border-purple-800 hover:bg-purple-900/40">
                          Use
                        </button>
                      )}
                      {!readOnly && (
                        <>
                          <button type="button"
                            onClick={e => { e.stopPropagation(); startEditFeature(field.id) }}
                            className="text-stone-500 hover:text-stone-300 p-1 rounded hover:bg-stone-700 shrink-0" title="Edit feature">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleRemoveFeature(i) }}
                            className="text-stone-500 hover:text-red-400 p-1 rounded hover:bg-stone-700 shrink-0">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-stone-700 pt-2">
                        {featDesc
                          ? <p className="text-stone-300 text-sm whitespace-pre-wrap">{featDesc}</p>
                          : <p className="text-stone-500 text-sm italic">No description.</p>
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {!readOnly && (
          <button type="button" onClick={() => { pendingNewFeature.current = true; addFeature({ name: '', source: '', description: '', has_charges: false, charges_current: 1, charges_max: 1, charges_recharge: '' }) }}
            className="btn btn-secondary btn-sm">
            <PlusIcon className="w-4 h-4 mr-1" /> Add Feature
          </button>
        )}
      </Section>

      {/* Equipment & Currency */}
      <Section title="Equipment & Currency" defaultOpen={false}>
        <EquipmentSection control={control} register={register} watch={watch} setValue={setValue} readOnly={readOnly} onEditingChange={setEquipmentHasEditing} />
      </Section>

      {/* Dynamic Spellcasting sections — one per spellcasting class */}
      {classFields.map((field, i) => {
        const cls = allClasses[i]
        if (!cls?.is_spellcaster || !cls?.casting_ability) return null
        return (
          <Section key={field.id}
            title={<span className="flex items-baseline gap-1.5">SPELLCASTING<span className="text-stone-500 font-normal normal-case tracking-normal">({cls.name || 'Unknown'})</span></span>}
            defaultOpen={false}>
            <SpellcastingBlock
              classIndex={i}
              castingAbility={cls.casting_ability}
              control={control}
              register={register}
              watch={watch}
              setValue={setValue}
              readOnly={readOnly}
              watchedProfBonus={watchedProfBonus}
              watchedAbilities={watchedAbilities}
            />
          </Section>
        )
      })}

      {/* Traits & Features */}
      <Section title="Personality & Traits" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Personality Traits', name: 'personality_traits' },
            { label: 'Ideals', name: 'ideals' },
            { label: 'Bonds', name: 'bonds' },
            { label: 'Flaws', name: 'flaws' },
          ].map(f => (
            <div key={f.name}>
              <label className="label">{f.label}</label>
              <textarea rows={3} {...register(f.name)} className="input resize-none" disabled={readOnly} />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <label className="label">Features & Traits</label>
          <textarea rows={4} {...register('features_and_traits')} className="input resize-none" disabled={readOnly} />
        </div>
        <div className="mt-3">
          <label className="label">Other Proficiencies & Languages</label>
          <textarea rows={3} {...register('other_proficiencies')} className="input resize-none" disabled={readOnly} />
        </div>
        <div className="mt-3">
          <label className="label">Additional Features & Traits</label>
          <textarea rows={3} {...register('additional_features_and_traits')} className="input resize-none" disabled={readOnly} />
        </div>
      </Section>

      {/* Backstory & Appearance */}
      <Section title="Backstory & Appearance" defaultOpen={false}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
          {[
            { label: 'Age', name: 'age' },
            { label: 'Height', name: 'height' },
            { label: 'Weight', name: 'weight' },
            { label: 'Eyes', name: 'eyes' },
            { label: 'Skin', name: 'skin' },
            { label: 'Hair', name: 'hair' },
          ].map(f => (
            <div key={f.name}>
              <label className="label">{f.label}</label>
              <input {...register(f.name)} className="input" disabled={readOnly} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Appearance Notes</label>
            <textarea rows={3} {...register('appearance_notes')} className="input resize-none" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Backstory</label>
            <textarea rows={3} {...register('character_backstory')} className="input resize-none" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Allies & Organizations</label>
            <textarea rows={3} {...register('allies_and_organizations')} className="input resize-none" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Treasure</label>
            <textarea rows={3} {...register('treasure')} className="input resize-none" disabled={readOnly} />
          </div>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes" defaultOpen={false}>
        <textarea rows={6} {...register('notes')} className="input resize-none w-full" disabled={readOnly} />
      </Section>

      {/* Delete class modal — step 1 */}
      <Modal open={!!deleteClassModal && deleteClassModal.step === 1}
        title="Remove class?"
        onConfirm={confirmRemoveClass} onCancel={() => setDeleteClassModal(null)}
        confirmLabel="Continue" danger>
        {deleteClassModal?.isSpellcaster ? (
          <>
            <strong>{deleteClassModal.className}</strong> is a spellcasting class.{' '}
            Removing it will permanently delete its entire spellbook and spell slot configuration.{' '}
            <span className="text-red-400 font-medium">This cannot be undone.</span>
          </>
        ) : (
          <>Are you sure you want to remove <strong>{deleteClassModal?.className}</strong> from this character?</>
        )}
      </Modal>

      {/* Delete class modal — step 2 */}
      <Modal open={!!deleteClassModal && deleteClassModal.step === 2}
        title="Are you absolutely sure?"
        onConfirm={confirmRemoveClass} onCancel={() => setDeleteClassModal(null)}
        confirmLabel="Yes, delete it" danger>
        This is your last chance.{' '}
        {deleteClassModal?.isSpellcaster
          ? <>All spells and slot data for <strong>{deleteClassModal.className}</strong> will be lost forever.</>
          : <><strong>{deleteClassModal?.className}</strong> will be removed.</>
        }
      </Modal>

      {/* Level up modal */}
      <Modal open={!!levelUpModal} title="Level Up?"
        onConfirm={confirmLevelUp} onCancel={() => setLevelUpModal(null)} confirmLabel="Level Up">
        Level up in <strong>{levelUpModal?.className}</strong>?{' '}
        (→ Level {(parseInt(watch(`classes.${levelUpModal?.index ?? 0}.level`)) || 0) + 1})
      </Modal>

      {/* Feature modals */}
      <Modal open={!!useFeatureModal} title="Use feature?"
        onConfirm={confirmUseFeature} onCancel={() => setUseFeatureModal(null)} confirmLabel="Use">
        Use <strong>{useFeatureModal?.name}</strong>? This will spend 1 charge.
      </Modal>
      <Modal open={!!outOfChargesModal} title="No charges remaining" onCancel={() => setOutOfChargesModal(null)}>
        <strong>{outOfChargesModal?.name}</strong> has no charges remaining.
      </Modal>

      {/* Save button at bottom too */}
      {!readOnly && (
        <div className="flex justify-end gap-2 mt-2">
          {error && <span className="text-red-400 text-sm self-center">{error}</span>}
          <button type="submit" disabled={isSubmitting}
            className={`btn ${saved ? 'bg-green-700 border-green-600 text-white hover:bg-green-600' : 'btn-primary'}`}>
            {isSubmitting ? 'Saving…' : saved ? 'Saved!' : isNew ? 'Create Character' : 'Save Changes'}
          </button>
        </div>
      )}
    </form>
  )
}
