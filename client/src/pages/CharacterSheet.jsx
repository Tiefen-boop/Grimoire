import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { PlusIcon, TrashIcon, ChevronDownIcon, PencilIcon, CheckIcon, SparklesIcon, XMarkIcon, CameraIcon } from '@heroicons/react/24/outline'
import EquipmentSection from '../components/EquipmentSection'
import Modal from '../components/Modal'
import { evalFormula } from '../utils/formulaEval'

const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const ABILITY_SHORT = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' }

const ABILITY_COLORS = {
  strength:     { border: 'border-red-700',    text: 'text-red-300',    dot: 'bg-red-400',    label: 'text-red-400'    },
  dexterity:    { border: 'border-green-700',  text: 'text-green-300',  dot: 'bg-green-400',  label: 'text-green-400'  },
  constitution: { border: 'border-orange-700', text: 'text-orange-300', dot: 'bg-orange-400', label: 'text-orange-400' },
  intelligence: { border: 'border-blue-700',   text: 'text-blue-300',   dot: 'bg-blue-400',   label: 'text-blue-400'   },
  wisdom:       { border: 'border-teal-700',   text: 'text-teal-300',   dot: 'bg-teal-400',   label: 'text-teal-400'   },
  charisma:     { border: 'border-violet-700', text: 'text-violet-300', dot: 'bg-violet-400', label: 'text-violet-400' },
}

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

// XP_THRESHOLDS[level] = total XP needed to reach that level (index 0 unused)
const XP_THRESHOLDS = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]
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

const WEAPON_SPECIFIC = {
  'simple-melee':   ['Club','Dagger','Greatclub','Handaxe','Javelin','Light Hammer','Mace','Quarterstaff','Sickle','Spear'],
  'simple-ranged':  ['Light Crossbow','Dart','Shortbow','Sling'],
  'martial-melee':  ['Battleaxe','Flail','Glaive','Greataxe','Greatsword','Halberd','Lance','Longsword','Maul','Morningstar','Pike','Rapier','Scimitar','Shortsword','Trident','War Pick','Warhammer','Whip'],
  'martial-ranged': ['Blowgun','Hand Crossbow','Heavy Crossbow','Longbow','Net'],
}

const ALL_SPECIFIC_WEAPONS = Object.values(WEAPON_SPECIFIC).flat().sort()

const ARMOR_PROF_CATEGORIES = ['Light', 'Medium', 'Heavy', 'Shield']

const TOOLS = [
  "Alchemist's Supplies","Brewer's Supplies","Calligrapher's Supplies","Carpenter's Tools",
  "Cartographer's Tools","Cobbler's Tools","Cook's Utensils","Glassblower's Tools",
  "Jeweler's Tools","Leatherworker's Tools","Mason's Tools","Painter's Supplies",
  "Potter's Tools","Smith's Tools","Tinker's Tools","Weaver's Tools","Woodcarver's Tools",
  "Disguise Kit","Forgery Kit","Dice Set","Dragonchess Set","Playing Card Set","Three-Dragon Ante Set",
  "Herbalism Kit","Navigator's Tools","Poisoner's Kit","Thieves' Tools",
  "Bagpipes","Drum","Dulcimer","Flute","Lute","Lyre","Horn","Pan Flute","Shawm","Viol",
  "Land Vehicles","Water Vehicles",
].sort()

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

function parseArithExpr(str) {
  const tokens = String(str).replace(/\s+/g, '').match(/\d+\.?\d*|[+\-*/()]/g) || []
  let pos = 0
  function parseExpr() {
    let left = parseTerm()
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++]; const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }
  function parseTerm() {
    let left = parseFactor()
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++]; const right = parseFactor()
      left = op === '*' ? left * right : right !== 0 ? left / right : left
    }
    return left
  }
  function parseFactor() {
    if (pos >= tokens.length) return 0
    if (tokens[pos] === '(') { pos++; const val = parseExpr(); pos++; return val }
    const n = parseFloat(tokens[pos++])
    return isNaN(n) ? 0 : n
  }
  try { const r = parseExpr(); return isFinite(r) ? r : null } catch { return null }
}

function checkWeaponProficiency(item, weaponProfs) {
  if (!item.weapon_class) return null
  const classMatch = item.weapon_class === 'simple' ? weaponProfs.includes('Simple') : weaponProfs.includes('Martial')
  const specificMatch = !!(item.weapon_specific && weaponProfs.includes(item.weapon_specific))
  return classMatch || specificMatch
}

function checkArmorProficiency(item, armorProfs) {
  if (!item.armor_category) return null
  const map = { light: 'Light', medium: 'Medium', heavy: 'Heavy', shield: 'Shield' }
  return armorProfs.includes(map[item.armor_category] || '')
}

function SubSection({ title, defaultOpen = true, children, bare = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (bare) return <>{children}</>
  return (
    <div className="border border-stone-700 rounded-lg mb-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 bg-stone-800 text-sm font-semibold text-stone-300 cursor-pointer select-none uppercase tracking-wide ${open ? 'rounded-t-lg' : 'rounded-lg'}`}>
        {title}
        <ChevronDownIcon className={`w-4 h-4 text-stone-500 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="p-3 rounded-b-lg">{children}</div>}
    </div>
  )
}

function ProfTagInput({ label, items, selected, onChange, readOnly, placeholder }) {
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const filtered = items.filter(x => x.toLowerCase().includes(search.toLowerCase()) && !selected.includes(x))

  function handleKeyDown(e) {
    if (!search && filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && filtered[activeIndex]) {
        onChange([...selected, filtered[activeIndex]])
        setSearch('')
        setActiveIndex(-1)
      }
    } else if (e.key === 'Escape') {
      setSearch('')
      setActiveIndex(-1)
    }
  }

  return (
    <div>
      {label && <div className="label text-xs mb-1">{label}</div>}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map(s => (
            <span key={s} className="flex items-center gap-0.5 bg-stone-700 text-stone-200 text-xs px-2 py-0.5 rounded border border-stone-600">
              {s}
              {!readOnly && (
                <button type="button" onClick={() => onChange(selected.filter(x => x !== s))}
                  className="ml-0.5 text-stone-400 hover:text-red-400">
                  <XMarkIcon className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="relative">
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setActiveIndex(-1) }}
            onKeyDown={handleKeyDown}
            className="input text-sm" placeholder={placeholder || 'Search...'} />
          {search && filtered.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 bg-stone-800 border border-stone-600 rounded mt-1 max-h-40 overflow-y-auto shadow-xl">
              {filtered.map((item, idx) => (
                <button type="button" key={item}
                  onClick={() => { onChange([...selected, item]); setSearch(''); setActiveIndex(-1) }}
                  className={`w-full text-left px-3 py-1.5 text-sm text-stone-200 ${idx === activeIndex ? 'bg-stone-600' : 'hover:bg-stone-700'}`}>
                  {item}
                </button>
              ))}
            </div>
          )}
          {search && filtered.length === 0 && (
            <div className="absolute z-20 top-full left-0 right-0 bg-stone-800 border border-stone-600 rounded mt-1 shadow-xl">
              <div className="px-3 py-2 text-xs text-stone-500 italic">No matches.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FreeTagInput({ label, selected, onChange, readOnly, placeholder }) {
  const [input, setInput] = useState('')

  function addTag(value) {
    const trimmed = value.trim().replace(/,$/, '').trim()
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed])
    }
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && selected.length > 0) {
      onChange(selected.slice(0, -1))
    }
  }

  return (
    <div>
      {label && <div className="label text-xs mb-1">{label}</div>}
      <div className="input flex flex-wrap gap-1 min-h-[2.5rem] cursor-text" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
        {selected.map(s => (
          <span key={s} className="flex items-center gap-0.5 bg-stone-700 text-stone-200 text-xs px-2 py-0.5 rounded border border-stone-600 self-center">
            {s}
            {!readOnly && (
              <button type="button" onClick={() => onChange(selected.filter(x => x !== s))}
                className="ml-0.5 text-stone-400 hover:text-red-400">
                <XMarkIcon className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <input type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (input.trim()) addTag(input) }}
            className="bg-transparent flex-1 min-w-20 text-sm text-stone-200 focus:outline-none self-center"
            placeholder={selected.length === 0 ? (placeholder || 'Type and press Enter…') : ''}
          />
        )}
      </div>
    </div>
  )
}

function PortraitCropModal({ onClose, onCrop }) {
  const [imgSrc, setImgSrc] = useState(null)
  const [imgEl, setImgEl] = useState(null)
  const containerRef = useRef(null)
  const [renderedImg, setRenderedImg] = useState(null)
  const [cropBox, setCropBox] = useState(null)
  const dragRef = useRef(null)
  const fileRef = useRef()

  function handleImgLoad(e) {
    const img = e.target
    const cont = containerRef.current
    if (!cont) return
    const cw = cont.clientWidth, ch = cont.clientHeight
    const nw = img.naturalWidth,  nh = img.naturalHeight
    const scale = Math.min(cw / nw, ch / nh)
    const rw = nw * scale, rh = nh * scale
    const rx = (cw - rw) / 2, ry = (ch - rh) / 2
    setRenderedImg({ x: rx, y: ry, w: rw, h: rh })
    const size = Math.min(rw, rh) * 0.8
    setCropBox({ x: rx + (rw - size) / 2, y: ry + (rh - size) / 2, size })
  }

  function startDrag(e, type) {
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, startBox: { ...cropBox } }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onMove(e) {
    if (!dragRef.current || !renderedImg) return
    const { type, startX, startY, startBox } = dragRef.current
    const dx = e.clientX - startX, dy = e.clientY - startY
    const { x: ix, y: iy, w: iw, h: ih } = renderedImg
    if (type === 'move') {
      setCropBox({
        size: startBox.size,
        x: Math.max(ix, Math.min(ix + iw - startBox.size, startBox.x + dx)),
        y: Math.max(iy, Math.min(iy + ih - startBox.size, startBox.y + dy)),
      })
    } else {
      let delta
      if (type === 'se') delta = Math.max(dx, dy)
      else if (type === 'sw') delta = Math.max(-dx, dy)
      else if (type === 'ne') delta = Math.max(dx, -dy)
      else delta = Math.max(-dx, -dy)
      let newSize = Math.max(30, startBox.size + delta)
      let bx = (type === 'sw' || type === 'nw') ? startBox.x + startBox.size - newSize : startBox.x
      let by = (type === 'ne' || type === 'nw') ? startBox.y + startBox.size - newSize : startBox.y
      bx = Math.max(ix, bx); by = Math.max(iy, by)
      newSize = Math.min(newSize, ix + iw - bx, iy + ih - by)
      setCropBox({ x: bx, y: by, size: newSize })
    }
  }

  function onUp() {
    dragRef.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  function handleCrop() {
    if (!imgEl || !cropBox || !renderedImg) return
    const canvas = document.createElement('canvas')
    canvas.width = 400; canvas.height = 400
    const ctx = canvas.getContext('2d')
    const scale = imgEl.naturalWidth / renderedImg.w
    ctx.drawImage(imgEl,
      (cropBox.x - renderedImg.x) * scale, (cropBox.y - renderedImg.y) * scale,
      cropBox.size * scale, cropBox.size * scale,
      0, 0, 400, 400)
    onCrop(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-stone-900 border border-stone-700 rounded-xl p-4 max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-stone-200 font-semibold mb-3">Character Portrait</h3>
        {!imgSrc ? (
          <div className="flex flex-col items-center gap-4 py-10 border-2 border-dashed border-stone-600 rounded-lg cursor-pointer hover:border-stone-500 transition-colors"
            onClick={() => fileRef.current.click()}>
            <CameraIcon className="w-10 h-10 text-stone-500" />
            <p className="text-stone-400 text-sm">Click to choose an image</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const file = e.target.files[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => setImgSrc(ev.target.result)
                reader.readAsDataURL(file)
              }} />
          </div>
        ) : (
          <>
            <p className="text-stone-500 text-xs mb-2">Drag to reposition · Drag corners to resize</p>
            <div ref={containerRef} className="relative select-none overflow-hidden rounded-lg bg-stone-950" style={{ height: 380 }}>
              <img src={imgSrc} ref={setImgEl} onLoad={handleImgLoad}
                className="absolute inset-0 w-full h-full object-contain" draggable={false} alt="crop preview" />
              {cropBox && (
                <>
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'rgba(0,0,0,0.6)',
                    clipPath: `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% ${cropBox.y}px,${cropBox.x}px ${cropBox.y}px,${cropBox.x}px ${cropBox.y+cropBox.size}px,${cropBox.x+cropBox.size}px ${cropBox.y+cropBox.size}px,${cropBox.x+cropBox.size}px ${cropBox.y}px,0% ${cropBox.y}px)`
                  }} />
                  <div className="absolute border-2 border-white"
                    style={{ left: cropBox.x, top: cropBox.y, width: cropBox.size, height: cropBox.size, cursor: 'move' }}
                    onPointerDown={e => startDrag(e, 'move')}>
                    <div className="absolute inset-0 pointer-events-none" style={{
                      backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.15) 1px,transparent 1px)',
                      backgroundSize: '33.33% 33.33%'
                    }} />
                    {[['nw',{top:-5,left:-5},'nw-resize'],['ne',{top:-5,right:-5},'ne-resize'],
                      ['sw',{bottom:-5,left:-5},'sw-resize'],['se',{bottom:-5,right:-5},'se-resize']
                    ].map(([dir, pos, cur]) => (
                      <div key={dir} className="absolute w-3 h-3 bg-white rounded-sm"
                        style={{ ...pos, cursor: cur }} onPointerDown={e => startDrag(e, dir)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
        <div className="flex gap-2 mt-3 justify-end">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          {imgSrc && <button type="button" onClick={handleCrop} className="btn btn-primary">Crop & Save</button>}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen = true, extraClass = '', locked = false, sectionKey, hidden = false }) {
  const key = sectionKey || (typeof title === 'string' ? title : null)
  const storageKey = key ? `grimoire_sec_${key}` : null
  const [open, setOpen] = useState(() => {
    if (storageKey) { try { const s = localStorage.getItem(storageKey); if (s !== null) return s === 'true' } catch {} }
    return defaultOpen
  })
  function toggle() {
    if (locked) return
    const next = !open
    setOpen(next)
    if (storageKey) { try { localStorage.setItem(storageKey, String(next)) } catch {} }
  }
  return (
    <div className={`card mb-4 ${extraClass}${hidden ? ' hidden' : ''}`}>
      <button type="button" onClick={toggle}
        className={`w-full flex items-center justify-between section-title ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
        {title}
        {!locked && <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} />}
      </button>
      {(open || locked) && <div>{children}</div>}
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
  { key: 'ritual',        label: 'Ritual',        accepts: (sp)      => !!sp.ritual },
  { key: 'concentration', label: 'Concentration', accepts: (sp)      => !!sp.concentration },
  { key: 'vocal',         label: 'Vocal',         accepts: (sp)      => !!sp.comp_v },
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

function AttacksSpellcastingBlock({ classIndex, className, castingAbility, control, watch, setValue, watchedProfBonus, watchedAbilities, concentratingInfo, onConcentrate }) {
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
        <span className="text-sm font-bold uppercase tracking-wide text-violet-400">
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
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <span className="text-stone-100 text-sm shrink-0">
                                    {sp.name || <span className="text-stone-500 italic">Unnamed spell</span>}
                                  </span>
                                  {sp.concentration && (
                                    <button type="button"
                                      onClick={e => { e.stopPropagation(); onConcentrate(key, sp.name || 'Unnamed spell') }}
                                      className={`text-xs px-1.5 py-0.5 rounded border shrink-0 transition-colors ${
                                        concentratingInfo?.key === key
                                          ? 'bg-violet-900/60 text-violet-300 border-violet-700 hover:bg-violet-900'
                                          : 'bg-transparent text-stone-600 border-stone-700 hover:text-violet-400 hover:border-violet-700'
                                      }`}>
                                      {concentratingInfo?.key === key ? 'Concentrating' : 'Concentrate'}
                                    </button>
                                  )}
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

function AutoResizeTextarea({ registerResult, className, style, ...props }) {
  const { ref: rhfRef, ...rest } = registerResult
  return (
    <textarea
      {...rest}
      {...props}
      className={className}
      style={{ ...style, overflow: 'hidden', resize: 'none' }}
      ref={el => { rhfRef(el); if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
      onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
    />
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
    addSpell({ level: lvl, name: '', cast_time: '', range: '', duration: '', school: '', ritual: false, concentration: false, comp_v: false, comp_s: false, comp_m: false, comp_m_text: '', prepared: false, description: '' })
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
      <div className="mb-5">
        <div className="flex justify-around mb-2">
          <div className="stat-box text-center min-w-24">
            <div className="label text-xs text-center">Spell Save DC</div>
            <div className="text-2xl font-bold text-center text-stone-100 py-1">{saveDC}</div>
          </div>
          <div className="stat-box text-center min-w-24">
            <div className="label text-xs text-center">Spell Attack</div>
            <div className="text-2xl font-bold text-center text-stone-100 py-1">{fmtMod(attackBonus)}</div>
          </div>
        </div>
        <div className="text-center text-stone-500 text-xs">{ABILITY_SHORT[castingAbility]} · Prof +{watchedProfBonus}</div>
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
                              <label className="flex items-center gap-1 text-xs text-stone-400 shrink-0 cursor-pointer">
                                <input type="checkbox" {...register(`classes.${classIndex}.spells.${i}.concentration`)} className="accent-violet-500" />
                                Concentration
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
                            <AutoResizeTextarea
                              registerResult={register(`classes.${classIndex}.spells.${i}.description`)}
                              className="input w-full text-sm"
                              placeholder="Description (optional)"
                              style={{ whiteSpace: 'pre-wrap', minHeight: '3rem' }}
                            />
                          </div>
                        ) : (
                          <div>
                            {/* View mode header row */}
                            <div className="flex items-start gap-1.5 px-3 py-2 cursor-pointer select-none"
                              onClick={() => toggleExpandSpell(field.id)}>
                              <ChevronDownIcon className={`w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5 transition-transform ${isExpandedSpell ? '' : '-rotate-90'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex flex-wrap flex-1 min-w-0 items-baseline gap-x-1.5 gap-y-0.5">
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
                                  </div>
                                  {!readOnly && (
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button type="button" onClick={e => { e.stopPropagation(); startEditSpell(field.id) }}
                                        className="text-stone-500 hover:text-stone-300 p-1 rounded hover:bg-stone-700">
                                        <PencilIcon className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" onClick={e => { e.stopPropagation(); removeSpellByIndex(field.id, i) }}
                                        className="text-stone-500 hover:text-red-400 p-1 rounded hover:bg-stone-700">
                                        <TrashIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {(sp.cast_time || sp.range || sp.concentration) && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    {sp.cast_time && <span className="text-xs text-stone-500"><span className="text-stone-600">Casting Time:</span> {sp.cast_time}</span>}
                                    {sp.range     && <span className="text-xs text-stone-500"><span className="text-stone-600">Range:</span> {sp.range}</span>}
                                    {sp.concentration && <span className="text-xs text-violet-400 font-medium">Concentration</span>}
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

function ExhaustionBlock({ watch, setValue, readOnly, onExhaustionChange }) {
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
              onClick={() => { if (readOnly) return; const next = exhaustion >= j ? j - 1 : j; setValue('exhaustion', next, { shouldDirty: true }); onExhaustionChange?.(next) }}
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
      weapon_profs: [], armor_profs: [], tool_profs: [], languages: [],
      portrait: '',
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
  const [currHpDisplay, setCurrHpDisplay] = useState(null)
  const [maxHpDisplay,  setMaxHpDisplay]  = useState(null)
  const currHpFocused = useRef(false)
  const maxHpFocused  = useRef(false)
  const [abilityDisplay, setAbilityDisplay] = useState({})
  const abilityFocusedRef = useRef(null)
  const [expDisplay, setExpDisplay] = useState(null)
  const expFocusedRef = useRef(false)
  const [showPortraitModal, setShowPortraitModal] = useState(false)
  const [showPortraitView, setShowPortraitView] = useState(false)
  const watchedPortrait = watch('portrait') ?? ''
  const TABS = ['main', 'inventory', 'combat', 'roleplay']
  const TAB_LABELS = { main: 'Main', inventory: '🎒 Inventory', combat: '⚔️ Combat', roleplay: '📖 Roleplay' }
  const [activeTab, setActiveTabState] = useState(() => {
    try { const t = localStorage.getItem('grimoire_active_tab'); return TABS.includes(t) ? t : 'main' } catch { return 'main' }
  })
  const [tabKey, setTabKey] = useState(0)
  const [slideDir, setSlideDir] = useState('left')
  function setTab(t, dir) {
    const curIdx = TABS.indexOf(activeTab)
    const newIdx = TABS.indexOf(t)
    const d = dir ?? (newIdx >= curIdx ? 'left' : 'right')
    setSlideDir(d)
    setTabKey(k => k + 1)
    setActiveTabState(t)
    try { localStorage.setItem('grimoire_active_tab', t) } catch {}
  }
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null; touchStartY.current = null
    if (Math.abs(dx) < 80) return
    if (Math.abs(dx) < Math.abs(dy) * 2) return
    const idx = TABS.indexOf(activeTab)
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1], 'left')
    else if (dx > 0 && idx > 0) setTab(TABS[idx - 1], 'right')
  }
  const [concentrationSavePrompt, setConcentrationSavePrompt] = useState(null)
  const [concentrationLostPrompt, setConcentrationLostPrompt] = useState(null)
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
  const [concentratingInfo, setConcentratingInfo] = useState(null) // { key, name }
  const [concentratePending, setConcentratePending] = useState(null) // { key, name }

  function handleConcentrate(key, name) {
    if (!concentratingInfo || concentratingInfo.key === key) {
      setConcentratingInfo(prev => prev?.key === key ? null : { key, name })
    } else {
      setConcentratePending({ key, name })
    }
  }

  function checkConcentrationSave(damage) {
    if (!concentratingInfo || damage <= 0) return
    const dc = Math.max(10, Math.floor(damage / 2))
    setConcentrationSavePrompt({ spellName: concentratingInfo.name, dc })
  }

  function loseConcentrationDirect() {
    if (!concentratingInfo) return
    setConcentrationLostPrompt(concentratingInfo.name)
    setConcentratingInfo(null)
    setConcentrationSavePrompt(null)
  }

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
    setValue('experience_points', 0, { shouldDirty: true })
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
    if (!isRemoving && !current.includes('Incapacitated') && newConditions.includes('Incapacitated')) {
      loseConcentrationDirect()
    }
  }

  const watchedAbilities  = watch(ABILITIES)
  const watchedProfs      = watch('saving_throw_profs') || []
  const watchedSkillProfs = watch('skill_profs') || []
  const watchedSkillExp   = watch('skill_expertise') || []
  const watchedProfBonus  = watch('proficiency_bonus') ?? 0
  const watchedWeaponProfs = watch('weapon_profs') || []
  const watchedArmorProfs  = watch('armor_profs')  || []
  const watchedToolProfs   = watch('tool_profs')   || []
  const watchedLanguages   = watch('languages')    || []
  const allClasses        = watch('classes') || []
  const watchedXp         = watch('experience_points') ?? 0
  const watchedInspiration = watch('inspiration') ?? 0
  const _xpTotalLevel = allClasses.reduce((sum, cls) => sum + (parseInt(cls.level) || 0), 0)
  const _xpCap = (_xpTotalLevel + 1) <= 20 ? XP_THRESHOLDS[_xpTotalLevel + 1] : null
  const xpFull = !!(_xpCap && watchedXp >= _xpCap)

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
    <form onSubmit={handleSubmit(onSubmit)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <style>{`
        @keyframes xp-shimmer {
          0%, 100% { box-shadow: 0 0 6px 2px rgba(234,179,8,0.5), 0 0 14px 4px rgba(202,138,4,0.25); }
          50%       { box-shadow: 0 0 14px 5px rgba(234,179,8,0.8), 0 0 28px 10px rgba(202,138,4,0.4); }
        }
        @keyframes magic-shimmer {
          0%, 100% { box-shadow: 0 0 6px 2px rgba(167,139,250,0.5), 0 0 14px 4px rgba(139,92,246,0.25); }
          50%       { box-shadow: 0 0 16px 6px rgba(167,139,250,0.8), 0 0 32px 12px rgba(139,92,246,0.4); }
        }
        .xp-full-active    { animation: xp-shimmer    1.8s ease-in-out infinite; }
        .inspiration-active { animation: magic-shimmer 1.8s ease-in-out infinite; }
        @media (max-width: 639px) {
          @keyframes tab-wipe-left  { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes tab-wipe-right { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          .tab-wipe-left  { animation: tab-wipe-left  0.22s ease-out; }
          .tab-wipe-right { animation: tab-wipe-right 0.22s ease-out; }
        }
      `}</style>
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

      {/* Tab bar */}
      <div className="flex border-b border-stone-700 mb-4">
        {TABS.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t ? 'border-red-600 text-stone-100' : 'border-transparent text-stone-500 hover:text-stone-300'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Animated tab content wrapper */}
      <div key={tabKey} className={`tab-wipe-${slideDir}`}>

      {/* Portrait — above Basic Information */}
      {showPortraitModal && (
        <PortraitCropModal
          onClose={() => setShowPortraitModal(false)}
          onCrop={dataUrl => { setValue('portrait', dataUrl, { shouldDirty: true }); setShowPortraitModal(false) }}
        />
      )}
      {showPortraitView && watchedPortrait && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowPortraitView(false)}>
          <img src={watchedPortrait} className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" alt="portrait" />
          <button type="button" className="absolute top-4 right-4 p-2 rounded-full bg-stone-800/80 text-stone-300 hover:text-white"
            onClick={() => setShowPortraitView(false)}>
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      )}
      <div className={`mb-4${activeTab !== 'main' && activeTab !== 'roleplay' ? ' hidden' : ''} ${activeTab === 'roleplay' ? 'flex flex-col sm:flex-row sm:items-center gap-3' : 'flex items-center gap-3'}`}>
        {/* Name/class — on mobile roleplay comes first (order-1), on desktop stays second */}
        <div className={activeTab === 'roleplay' ? 'order-1 sm:order-2' : ''}>
          <div className="text-xl font-bold text-stone-100">{watch('name') || (isNew ? 'New Character' : '—')}</div>
          <div className="text-sm text-stone-400 mt-0.5">
            {[watch('race'), watch('class')].filter(Boolean).join(' · ')}
          </div>
        </div>
        {/* Portrait */}
        <div className={`relative group shrink-0 ${activeTab === 'roleplay' ? 'order-2 sm:order-1' : ''}`}>
          <div
            className={`rounded-xl overflow-hidden bg-stone-800 border border-stone-700 ${activeTab === 'roleplay' ? 'w-full aspect-square sm:w-24 sm:h-24 sm:aspect-auto' : 'w-20 h-20 sm:w-24 sm:h-24'}`}
            style={{ cursor: watchedPortrait ? 'zoom-in' : readOnly ? 'default' : 'pointer' }}
            onClick={() => { if (watchedPortrait) setShowPortraitView(true); else if (!readOnly) setShowPortraitModal(true) }}>
            {watchedPortrait ? (
              <img src={watchedPortrait} className="w-full h-full object-cover" alt="portrait" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 gap-2">
                <CameraIcon className="w-7 h-7" />
                {!readOnly && <span className="text-xs">Upload</span>}
              </div>
            )}
          </div>
          {!readOnly && watchedPortrait && (
            <button type="button"
              onClick={e => { e.stopPropagation(); setShowPortraitModal(true) }}
              className="absolute bottom-1 right-1 p-1 bg-stone-800 border border-stone-600 rounded-lg text-stone-400 hover:text-stone-200 opacity-0 group-hover:opacity-100 transition-opacity">
              <CameraIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information" extraClass={watchedInspiration ? 'inspiration-active' : xpFull ? 'xp-full-active' : ''} hidden={activeTab !== 'main'}>
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
                onClick={() => { pendingNewClass.current = true; addClass({ name: '', subclass: '', level: 1, hit_die: '', is_spellcaster: false, casting_ability: '', spell_slots: {}, spells: [] }); setValue('experience_points', 0, { shouldDirty: true }) }}
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
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                      <span className="text-stone-100 text-sm font-medium whitespace-nowrap">
                        {cls.name || <span className="text-stone-500 italic">Unnamed class</span>}
                        {cls.subclass && <span className="text-stone-400 font-normal"> / {cls.subclass}</span>}
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
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
                        {cls.hit_die && <span className="text-xs text-stone-500 shrink-0">{cls.hit_die}</span>}
                        {cls.level > 0 && <span className="text-xs bg-stone-700 text-stone-300 px-2 py-0.5 rounded shrink-0">Lv. {cls.level}</span>}
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
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Secondary stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {/* Experience Points with XP bar */}
          {(() => {
            const totalLevel = allClasses.reduce((sum, cls) => sum + (parseInt(cls.level) || 0), 0)
            const nextLevel = totalLevel + 1
            const xpCap = nextLevel <= 20 ? XP_THRESHOLDS[nextLevel] : null
            const xpFill = xpCap ? Math.min(100, (watchedXp / xpCap) * 100) : 0
            return (
              <div className="stat-box overflow-hidden relative">
                {xpCap && (
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/50 to-amber-400/35 transition-all duration-300 origin-left"
                    style={{ transform: `scaleX(${xpFill / 100})` }} />
                )}
                <div className="relative label text-xs text-center">Experience{xpCap ? <span className="text-stone-500"> / {xpCap.toLocaleString()}</span> : ''}</div>
                <input type="text" inputMode="numeric"
                  value={expFocusedRef.current ? (expDisplay ?? '') : watchedXp}
                  onFocus={() => { expFocusedRef.current = true; setExpDisplay(String(watchedXp)) }}
                  onChange={e => setExpDisplay(e.target.value)}
                  onBlur={() => {
                    expFocusedRef.current = false
                    const raw = (expDisplay ?? '').trim()
                    const prev = watchedXp
                    if (!raw) { setExpDisplay(null); return }
                    const leadingOp = raw.match(/^([+\-*/])(.+)$/)
                    let result = leadingOp ? parseArithExpr(`${prev}${leadingOp[1]}${leadingOp[2]}`) : parseArithExpr(raw)
                    if (result === null) result = prev
                    const final = xpCap ? Math.min(xpCap, Math.max(0, Math.round(result))) : Math.max(0, Math.round(result))
                    setValue('experience_points', final, { shouldDirty: true })
                    setExpDisplay(null)
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  className="relative no-spinner bg-transparent text-center text-xl font-bold w-full focus:outline-none py-0.5 text-stone-100"
                  disabled={readOnly} />
              </div>
            )
          })()}
          <div className="stat-box">
            <div className="label text-xs text-center">Proficiency Bonus</div>
            <div className="text-xl font-bold text-center text-stone-100 py-0.5">+{watchedProfBonus}</div>
            <input type="hidden" {...register('proficiency_bonus', { valueAsNumber: true })} />
          </div>
          {/* Inspiration toggle */}
          <button type="button" disabled={readOnly}
            onClick={() => setValue('inspiration', watchedInspiration ? 0 : 1, { shouldDirty: true })}
            className={`stat-box flex items-center justify-center p-2 w-full transition-all duration-300 ${
              watchedInspiration
                ? 'bg-violet-900/30 border-violet-500'
                : 'hover:bg-stone-700/40'
            }`}>
            <span className={`font-semibold text-sm ${watchedInspiration ? 'text-violet-300' : 'text-stone-500'}`}>
              {watchedInspiration ? '✦ Inspired' : 'Inspire'}
            </span>
          </button>
        </div>
      </Section>

      {/* Ability Scores & Derived */}
      <Section title={<span className="text-sky-300">🎲 Ability Scores</span>} sectionKey="Ability Scores" hidden={activeTab !== 'main'}>
        {/* Ability score blocks */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          {ABILITIES.map((ability, i) => {
            const c = ABILITY_COLORS[ability]
            return (
              <div key={ability} className={`stat-box border ${c.border} text-center`}>
                <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${c.label}`}>{ABILITY_SHORT[ability]}</div>
                <input
                  type="text" inputMode="numeric"
                  value={abilityFocusedRef.current === ability ? (abilityDisplay[ability] ?? '') : (watchedAbilities[i] ?? 10)}
                  onFocus={() => { abilityFocusedRef.current = ability; setAbilityDisplay(p => ({ ...p, [ability]: String(watchedAbilities[i] ?? 10) })) }}
                  onChange={e => setAbilityDisplay(p => ({ ...p, [ability]: e.target.value }))}
                  onBlur={() => {
                    abilityFocusedRef.current = null
                    const raw = (abilityDisplay[ability] ?? '').trim()
                    const prev = watchedAbilities[i] ?? 10
                    if (!raw) { setAbilityDisplay(p => ({ ...p, [ability]: null })); return }
                    const leadingOp = raw.match(/^([+\-*/])(.+)$/)
                    let result = leadingOp ? parseArithExpr(`${prev}${leadingOp[1]}${leadingOp[2]}`) : parseArithExpr(raw)
                    if (result === null) result = prev
                    const final = Math.min(30, Math.max(1, Math.round(result)))
                    setValue(ability, final, { shouldDirty: true })
                    setAbilityDisplay(p => ({ ...p, [ability]: null }))
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  className={`no-spinner bg-transparent text-center text-2xl font-bold w-full focus:outline-none py-0.5 mb-0.5 ${c.text}`}
                  disabled={readOnly}
                />
                <div className={`text-sm font-semibold ${c.text} opacity-80`}>{fmtMod(mod(watchedAbilities[i] || 10))}</div>
              </div>
            )
          })}
        </div>

        {/* Saving Throws + Passive scores */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="label mb-2">Saving Throws</div>
            <div className="space-y-0.5">
              {ABILITIES.map(ability => {
                const c = ABILITY_COLORS[ability]
                const isProficient = watchedProfs.includes(ability)
                return (
                  <div key={ability}
                    className="flex items-center gap-2 cursor-pointer py-1 rounded px-1 hover:bg-stone-800/60 transition-colors"
                    onClick={() => !readOnly && toggleArrayValue('saving_throw_profs', ability)}>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${isProficient ? `${c.dot} border-transparent` : 'bg-transparent border-stone-600'}`} />
                    <span className={`text-sm flex-1 font-medium transition-colors ${isProficient ? c.text : 'text-stone-400'}`}>{ABILITY_SHORT[ability]}</span>
                    <span className={`text-sm w-8 text-right tabular-nums transition-colors ${isProficient ? c.text : 'text-stone-400'}`}>{fmtMod(getSavingThrow(ability))}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 justify-start">
            {(() => {
              const passivePerception = 10 + getSkillBonus(SKILLS.find(s => s.name === 'Perception'))
              const passiveInsight    = 10 + getSkillBonus(SKILLS.find(s => s.name === 'Insight'))
              return (
                <>
                  <div className={`stat-box border ${ABILITY_COLORS.wisdom.border} text-center`}>
                    <div className="label text-xs text-center">Passive Perception</div>
                    <div className={`text-2xl font-bold text-center py-1 ${ABILITY_COLORS.wisdom.text}`}>{passivePerception}</div>
                  </div>
                  <div className={`stat-box border ${ABILITY_COLORS.wisdom.border} text-center`}>
                    <div className="label text-xs text-center">Passive Insight</div>
                    <div className={`text-2xl font-bold text-center py-1 ${ABILITY_COLORS.wisdom.text}`}>{passiveInsight}</div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Skills */}
        <div className="border-t border-stone-700 pt-3">
          <div className="label mb-2">Skills <span className="font-normal text-stone-500 text-xs">(● proficient · ◆ expertise)</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            {SKILLS.map(skill => {
              const isProficient = watchedSkillProfs.includes(skill.name)
              const isExpert = watchedSkillExp.includes(skill.name)
              const c = ABILITY_COLORS[skill.ability]
              return (
                <div key={skill.name} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-stone-800/60 transition-colors">
                  <button type="button" disabled={readOnly}
                    onClick={() => {
                      if (readOnly) return
                      if (isProficient && isExpert) {
                        toggleArrayValue('skill_expertise', skill.name)
                        toggleArrayValue('skill_profs', skill.name)
                      } else {
                        toggleArrayValue('skill_profs', skill.name)
                      }
                    }}
                    className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${isProficient ? `${c.dot} border-transparent` : 'bg-transparent border-stone-600'}`}
                    title={isProficient ? 'Remove proficiency' : 'Add proficiency'}
                  />
                  <button type="button" disabled={readOnly}
                    onClick={() => { if (readOnly) return; if (!isExpert && !isProficient) toggleArrayValue('skill_profs', skill.name); toggleArrayValue('skill_expertise', skill.name) }}
                    className={`w-3 h-3 rotate-45 border-2 shrink-0 transition-colors ${isExpert ? `${c.dot} border-transparent` : 'bg-transparent border-stone-700'}`}
                    title={isExpert ? 'Remove expertise' : 'Add expertise'}
                  />
                  <span className={`text-sm flex-1 transition-colors ${isExpert ? `font-semibold ${c.text}` : isProficient ? c.text : 'text-stone-400'}`}>{skill.name}</span>
                  <span className={`text-xs font-medium ${c.label}`}>{ABILITY_SHORT[skill.ability]}</span>
                  <span className={`text-sm w-8 text-right tabular-nums ${isExpert ? `font-semibold ${c.text}` : isProficient ? c.text : 'text-stone-400'}`}>{fmtMod(getSkillBonus(skill))}</span>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* Combat */}
      <Section title={<span className="text-red-300">⚔️ Combat</span>} sectionKey="Combat" locked={activeTab === 'combat'} hidden={activeTab !== 'main' && activeTab !== 'combat'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">

          {/* HP + Temp HP bars */}
          <div className="flex flex-col gap-1">
            {/* HP Bar */}
            <div className="relative h-12 rounded-lg overflow-hidden bg-stone-900">
              <div className="absolute inset-y-0 left-0 bg-red-950 transition-all duration-200 rounded-lg"
                style={{ width: `${hpBarWidthPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-red-700 transition-all duration-200 rounded-lg"
                style={{ width: `${redFillPct}%` }} />
              <div className="absolute inset-0 flex items-center justify-center gap-1 z-10">
                <span className="text-red-200 font-semibold text-sm select-none">HP</span>
                <input type="text" inputMode="numeric"
                  value={currHpFocused.current ? (currHpDisplay ?? '') : (watchedCurrHp ?? 0)}
                  onFocus={() => { currHpFocused.current = true; setCurrHpDisplay(String(watchedCurrHp ?? 0)) }}
                  onChange={e => setCurrHpDisplay(e.target.value)}
                  onBlur={() => {
                    currHpFocused.current = false
                    const raw = (currHpDisplay ?? '').trim()
                    const prev = watchedCurrHp ?? 0
                    const max  = watchedMaxHp  ?? 0
                    if (!raw) { setCurrHpDisplay(null); return }
                    const leadingOp = raw.match(/^([+\-*/])(.+)$/)
                    let result = leadingOp
                      ? parseArithExpr(`${prev}${leadingOp[1]}${leadingOp[2]}`)
                      : parseArithExpr(raw)
                    if (result === null) result = prev
                    const final = Math.min(max, Math.max(0, Math.round(result)))
                    setValue('current_hp', final, { shouldDirty: true })
                    setCurrHpDisplay(null)
                    if (final === 0 && prev > 0) {
                      const current = watch('conditions') || []
                      if (!current.includes('Unconscious')) {
                        let newConds = [...current, 'Unconscious']
                        for (const c of (CONDITION_CHAINS['Unconscious'] || [])) {
                          if (!newConds.includes(c)) newConds.push(c)
                        }
                        setValue('conditions', newConds, { shouldDirty: true })
                      }
                      loseConcentrationDirect()
                    } else {
                      checkConcentrationSave(prev - final)
                    }
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  className="no-spinner bg-transparent text-stone-100 font-bold text-lg text-right w-12 focus:outline-none font-sans"
                  disabled={readOnly} />
                <span className="text-stone-400 font-bold text-lg select-none">/</span>
                <input type="text" inputMode="numeric"
                  value={maxHpFocused.current ? (maxHpDisplay ?? '') : (watchedMaxHp ?? 0)}
                  onFocus={() => { maxHpFocused.current = true; setMaxHpDisplay(String(watchedMaxHp ?? 0)) }}
                  onChange={e => setMaxHpDisplay(e.target.value)}
                  onBlur={() => {
                    maxHpFocused.current = false
                    const raw = (maxHpDisplay ?? '').trim()
                    const prev = watchedMaxHp ?? 0
                    if (!raw) { setMaxHpDisplay(null); return }
                    const leadingOp = raw.match(/^([+\-*/])(.+)$/)
                    let result = leadingOp
                      ? parseArithExpr(`${prev}${leadingOp[1]}${leadingOp[2]}`)
                      : parseArithExpr(raw)
                    if (result === null) result = prev
                    const newMax = Math.max(0, Math.round(result))
                    setValue('max_hp', newMax, { shouldDirty: true })
                    const curr = watchedCurrHp ?? 0
                    const clampedCurr = Math.min(curr, newMax)
                    if (curr > newMax) setValue('current_hp', clampedCurr, { shouldDirty: true })
                    setMaxHpDisplay(null)
                    checkConcentrationSave(prev - newMax)
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
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
                <input type="text" inputMode="numeric"
                  value={tempHpDisplayStr}
                  placeholder={tempHpDisplayStr === '' ? 'Temp HP' : ''}
                  onChange={e => setTempHpDisplayStr(e.target.value)}
                  onBlur={() => {
                    const raw = tempHpDisplayStr.trim()
                    if (raw === '') { setValue('temp_hp', 0, { shouldDirty: true }); return }
                    const prev = watchedTempHp ?? 0
                    const leadingOp = raw.match(/^([+\-*/])(.+)$/)
                    let result = leadingOp
                      ? parseArithExpr(`${prev}${leadingOp[1]}${leadingOp[2]}`)
                      : parseArithExpr(raw)
                    if (result === null) result = prev
                    if (result < 0) {
                      // Damage exceeds temp HP — carry overflow to current HP
                      const overflow = Math.round(Math.abs(result))
                      setValue('temp_hp', 0, { shouldDirty: true })
                      setTempHpDisplayStr('')
                      const currHp = watchedCurrHp ?? 0
                      const newCurrHp = Math.max(0, currHp - overflow)
                      setValue('current_hp', newCurrHp, { shouldDirty: true })
                      const totalDamage = prev + overflow
                      if (newCurrHp === 0 && currHp > 0) {
                        const current = watch('conditions') || []
                        if (!current.includes('Unconscious')) {
                          let newConds = [...current, 'Unconscious']
                          for (const c of (CONDITION_CHAINS['Unconscious'] || [])) {
                            if (!newConds.includes(c)) newConds.push(c)
                          }
                          setValue('conditions', newConds, { shouldDirty: true })
                        }
                        loseConcentrationDirect()
                      } else {
                        checkConcentrationSave(totalDamage)
                      }
                    } else {
                      const final = Math.max(0, Math.round(result))
                      setValue('temp_hp', final, { shouldDirty: true })
                      setTempHpDisplayStr(final > 0 ? String(final) : '')
                      checkConcentrationSave(prev - final)
                    }
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
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
          <ExhaustionBlock watch={watch} setValue={setValue} readOnly={readOnly}
            onExhaustionChange={lvl => { if (lvl >= 6) loseConcentrationDirect() }} />

        </div>

        {/* Conditions */}
        <ConditionsBlock
          watch={watch}
          readOnly={readOnly}
          onToggle={handleConditionToggle}
        />
      </Section>

      {/* Attacks */}
      <Section title={<span className="text-orange-300">🗡️ Attacks & Spellcasting</span>} sectionKey="Attacks & Spellcasting" defaultOpen={false} locked={activeTab === 'combat'} hidden={activeTab !== 'main' && activeTab !== 'combat'}>
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
                    const proficient = checkWeaponProficiency(item, watchedWeaponProfs)
                    const evalStats  = proficient === false ? { ...charStats, proficiency_bonus: 0 } : charStats
                    const atkValue   = atkFormula ? evalFormula(atkFormula, evalStats) : '—'
                    const dmgValue   = dmgFormula ? evalFormula(dmgFormula, evalStats) : '—'
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
                            <div>
                              <span className="text-stone-100 font-medium">{item.name || <span className="text-stone-500 italic">Unnamed</span>}</span>
                              {range && <span className="text-stone-400 text-xs ml-1.5">({range})</span>}
                              {proficient === false && (
                                <div className="text-red-500 text-xs font-semibold leading-none mt-0.5">NOT PROFICIENT</div>
                              )}
                            </div>
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
              concentratingInfo={concentratingInfo}
              onConcentrate={handleConcentrate}
            />
          )
        })}
      </Section>

      {/* Features, Proficiencies & Languages */}
      <Section
        title={<span className="text-emerald-300">{activeTab === 'combat' ? '📜 Features' : activeTab === 'roleplay' ? '🌍 Languages' : '📜 Features, Proficiencies & Languages'}</span>}
        sectionKey="Features, Proficiencies & Languages"
        defaultOpen={false}
        locked={activeTab !== 'main'}
        hidden={activeTab === 'inventory'}>

        <div className={activeTab === 'roleplay' ? 'hidden' : ''}>
        <SubSection title="Features" bare={activeTab === 'combat'}>
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
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {/* Group 1: name + source — break within this group only if name alone is too wide */}
                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                            <span className="text-stone-100 text-sm font-medium">
                              {featName || <span className="text-stone-500 italic">Unnamed feature</span>}
                            </span>
                            {featSource && (
                              <span className="text-stone-500 text-xs">({featSource})</span>
                            )}
                          </div>
                          {/* Group 2: charges + Use — wraps as a unit after group 1 */}
                          {featHasCharges && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-stone-400 text-xs">{featChargesCur ?? 0}/{featChargesMax ?? 0}</span>
                              {rechLabel && <span className="text-stone-500 text-xs">({rechLabel})</span>}
                              {!readOnly && (
                                <button type="button"
                                  onClick={e => { e.stopPropagation(); handleUseFeature(i) }}
                                  className="btn btn-secondary btn-sm py-0.5 px-2 text-xs text-purple-300 border-purple-800 hover:bg-purple-900/40">
                                  Use
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button type="button"
                            onClick={e => { e.stopPropagation(); startEditFeature(field.id) }}
                            className="text-stone-500 hover:text-stone-300 p-1 rounded hover:bg-stone-700" title="Edit feature">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleRemoveFeature(i) }}
                            className="text-stone-500 hover:text-red-400 p-1 rounded hover:bg-stone-700">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
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
        </SubSection>
        </div>{/* end features visibility wrapper */}

        <div className={activeTab !== 'main' ? 'hidden' : ''}>
        <SubSection title="Proficiencies" defaultOpen={false}>
          {/* Weapons */}
          <div className="mb-4">
            <div className="label text-xs mb-2">Weapons</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {['Simple', 'Martial'].map(cat => {
                const active = watchedWeaponProfs.includes(cat)
                return (
                  <button key={cat} type="button"
                    disabled={readOnly}
                    onClick={() => {
                      const next = active
                        ? watchedWeaponProfs.filter(x => x !== cat)
                        : [...watchedWeaponProfs, cat]
                      setValue('weapon_profs', next, { shouldDirty: true })
                    }}
                    className={`text-xs px-3 py-1 rounded border transition-colors ${active ? 'bg-green-900 text-green-300 border-green-700' : 'bg-stone-800 text-stone-400 border-stone-600 hover:border-stone-500'} ${readOnly ? 'cursor-default opacity-70' : 'cursor-pointer'}`}>
                    {cat}
                  </button>
                )
              })}
            </div>
            <ProfTagInput
              items={ALL_SPECIFIC_WEAPONS}
              selected={watchedWeaponProfs.filter(p => p !== 'Simple' && p !== 'Martial')}
              onChange={specifics => setValue('weapon_profs', [...watchedWeaponProfs.filter(p => p === 'Simple' || p === 'Martial'), ...specifics], { shouldDirty: true })}
              readOnly={readOnly}
              placeholder="Search specific weapon..."
            />
          </div>

          {/* Armor */}
          <div className="mb-4">
            <div className="label text-xs mb-2">Armor</div>
            <div className="flex flex-wrap gap-1">
              {ARMOR_PROF_CATEGORIES.map(cat => {
                const active = watchedArmorProfs.includes(cat)
                return (
                  <button key={cat} type="button"
                    disabled={readOnly}
                    onClick={() => {
                      const next = active
                        ? watchedArmorProfs.filter(x => x !== cat)
                        : [...watchedArmorProfs, cat]
                      setValue('armor_profs', next, { shouldDirty: true })
                    }}
                    className={`text-xs px-3 py-1 rounded border transition-colors ${active ? 'bg-blue-900 text-blue-300 border-blue-700' : 'bg-stone-800 text-stone-400 border-stone-600 hover:border-stone-500'} ${readOnly ? 'cursor-default opacity-70' : 'cursor-pointer'}`}>
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tools */}
          <div>
            <ProfTagInput
              label="Tools"
              items={TOOLS}
              selected={watchedToolProfs}
              onChange={next => setValue('tool_profs', next, { shouldDirty: true })}
              readOnly={readOnly}
              placeholder="Search tool..."
            />
          </div>
        </SubSection>
        </div>{/* end proficiencies visibility wrapper */}

        <div className={activeTab === 'combat' ? 'hidden' : ''}>
        <SubSection title="Languages" defaultOpen={false} bare={activeTab === 'roleplay'}>
          <FreeTagInput
            selected={watchedLanguages}
            onChange={next => setValue('languages', next, { shouldDirty: true })}
            readOnly={readOnly}
            placeholder="Type a language and press Enter…"
          />
        </SubSection>
        </div>{/* end languages visibility wrapper */}

      </Section>

      {/* Equipment & Currency */}
      <Section title={<span className="text-amber-300">🎒 Equipment & Currency</span>} sectionKey="Equipment & Currency" defaultOpen={false} locked={activeTab === 'inventory'} hidden={activeTab !== 'main' && activeTab !== 'inventory'}>
        <EquipmentSection control={control} register={register} watch={watch} setValue={setValue} readOnly={readOnly}
          onEditingChange={setEquipmentHasEditing}
          weaponProfs={watchedWeaponProfs}
          armorProfs={watchedArmorProfs}
        />
      </Section>

      {/* Dynamic Spellcasting sections — one per spellcasting class */}
      {classFields.map((field, i) => {
        const cls = allClasses[i]
        if (!cls?.is_spellcaster || !cls?.casting_ability) return null
        return (
          <Section key={field.id}
            title={<span className="flex items-baseline gap-1.5 text-yellow-300">✨ SPELLCASTING<span className="text-stone-500 font-normal normal-case tracking-normal">({cls.name || 'Unknown'})</span></span>}
            sectionKey={`Spellcasting-${field.id}`}
            defaultOpen={false}
            locked={activeTab === 'combat'}
            hidden={activeTab !== 'main' && activeTab !== 'combat'}>
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
      <Section title={<span className="text-violet-300">💭 Personality & Traits</span>} sectionKey="Personality & Traits" defaultOpen={false} locked={activeTab === 'roleplay'} hidden={activeTab !== 'main' && activeTab !== 'roleplay'}>
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
      <Section title={<span className="text-teal-300">📖 Backstory & Appearance</span>} sectionKey="Backstory & Appearance" defaultOpen={false} locked={activeTab === 'roleplay'} hidden={activeTab !== 'main' && activeTab !== 'roleplay'}>
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
      <Section title={<span className="text-stone-400">📝 Notes</span>} sectionKey="Notes" defaultOpen={false} locked={activeTab === 'roleplay'} hidden={activeTab !== 'main' && activeTab !== 'roleplay'}>
        <textarea rows={6} {...register('notes')} className="input resize-none w-full" disabled={readOnly} />
      </Section>

      </div>{/* end animated tab content wrapper */}

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

      {/* Concentration lost notification */}
      <Modal open={!!concentrationLostPrompt} title="Lost Concentration"
        onCancel={() => setConcentrationLostPrompt(null)} cancelLabel="OK">
        Lost concentration on <strong className="text-violet-300">{concentrationLostPrompt}</strong>.
      </Modal>

      {/* Concentration save prompt */}
      {concentrationSavePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-stone-100 mb-4 text-center">
              Keep concentration on{' '}
              <span className="text-violet-300">{concentrationSavePrompt.spellName}</span>?
            </h3>
            <div className="flex justify-center mb-3">
              <div className="stat-box text-center min-w-28">
                <div className="label text-xs text-center">Constitution Save DC</div>
                <div className="text-3xl font-bold text-center text-stone-100 py-1">{concentrationSavePrompt.dc}</div>
              </div>
            </div>
            <p className="text-center text-stone-400 text-sm mb-5">
              CON save modifier: <span className={`font-semibold ${ABILITY_COLORS.constitution.text}`}>{fmtMod(getSavingThrow('constitution'))}</span>
            </p>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setConcentrationSavePrompt(null)}
                className="btn flex-1 bg-green-800 border-green-700 text-green-100 hover:bg-green-700">
                Success
              </button>
              <button type="button"
                onClick={() => { setConcentratingInfo(null); setConcentrationSavePrompt(null) }}
                className="btn flex-1 bg-red-900 border-red-800 text-red-100 hover:bg-red-800">
                Failure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Concentration switch confirmation */}
      <Modal open={!!concentratePending} title="Already Concentrating"
        onConfirm={() => { setConcentratingInfo(concentratePending); setConcentratePending(null) }}
        onCancel={() => setConcentratePending(null)}
        confirmLabel="Switch">
        Already concentrating on <strong>{concentratingInfo?.name}</strong><br />Are you sure?
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
