import { useState, useEffect, useRef } from 'react'
import { useFieldArray } from 'react-hook-form'
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, ChevronDownIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Modal from './Modal'
import { evalFormula } from '../utils/formulaEval'

const WEAPON_TYPES = [
  { value: 'simple-melee',   label: 'Simple Melee' },
  { value: 'simple-ranged',  label: 'Simple Ranged' },
  { value: 'martial-melee',  label: 'Martial Melee' },
  { value: 'martial-ranged', label: 'Martial Ranged' },
]

const WEAPON_CLASS    = [{ value: 'simple', label: 'Simple' }, { value: 'martial', label: 'Martial' }]
const WEAPON_RANGE    = [{ value: 'melee',  label: 'Melee'  }, { value: 'ranged',  label: 'Ranged'  }]
const WEAPON_SPECIFIC = {
  'simple-melee':  ['Club', 'Dagger', 'Greatclub', 'Handaxe', 'Javelin', 'Light Hammer', 'Mace', 'Quarterstaff', 'Sickle', 'Spear'],
  'simple-ranged': ['Light Crossbow', 'Dart', 'Shortbow', 'Sling'],
  'martial-melee': ['Battleaxe', 'Flail', 'Glaive', 'Greataxe', 'Greatsword', 'Halberd', 'Lance', 'Longsword', 'Maul', 'Morningstar', 'Pike', 'Rapier', 'Scimitar', 'Shortsword', 'Trident', 'War Pick', 'Warhammer', 'Whip'],
  'martial-ranged': ['Blowgun', 'Hand Crossbow', 'Heavy Crossbow', 'Longbow', 'Net'],
}

const ARMOR_CATEGORIES = [
  { value: 'light',   label: 'Light Armor' },
  { value: 'medium',  label: 'Medium Armor' },
  { value: 'heavy',   label: 'Heavy Armor' },
  { value: 'shield',  label: 'Shield' },
]

const WEAPON_PROPERTIES = [
  { name: 'Ammunition',  extraType: 'range', extraLabel: 'Range (e.g. 80/320)' },
  { name: 'Finesse',     extraType: null },
  { name: 'Heavy',       extraType: null },
  { name: 'Light',       extraType: null },
  { name: 'Loading',     extraType: null },
  { name: 'Reach',       extraType: null },
  { name: 'Silvered',    extraType: null },
  { name: 'Special',     extraType: 'text', extraLabel: 'Special description' },
  { name: 'Thrown',      extraType: 'range', extraLabel: 'Range (e.g. 20/60)' },
  { name: 'Two-Handed',  extraType: null },
  { name: 'Versatile',   extraType: 'damage', extraLabel: 'Two-handed damage (e.g. 1d8)' },
]

const CATEGORIES = [
  {
    type: 'weapon', label: 'Weapons', color: 'text-red-400',
    mkDefault: () => ({ name: '', price: '', amount: '1', description: '', type: 'weapon', attuned: false, weapon_class: 'simple', weapon_range: 'melee', weapon_specific: '', attack_modifier: '', damage_roll: '', properties: [], has_charges: false, charges_current: 0, charges_max: 0, charges_recharge: '', finesse_active: false, finesse_attack_modifier: '', finesse_damage_roll: '', versatile_active: false }),
  },
  {
    type: 'armor', label: 'Armor', color: 'text-blue-400',
    mkDefault: () => ({ name: '', price: '', amount: '1', description: '', type: 'armor', attuned: false, armor_category: 'light', ac_formula: '', equipped: false, has_charges: false, charges_current: 0, charges_max: 0, charges_recharge: '' }),
  },
  {
    type: 'usable', label: 'Usables', color: 'text-green-400',
    mkDefault: () => ({ name: '', price: '', amount: '1', description: '', type: 'usable', attuned: false }),
  },
  {
    type: 'misc', label: 'Misc', color: 'text-stone-400',
    mkDefault: () => ({ name: '', price: '', amount: '1', description: '', type: 'misc', attuned: false, has_charges: false, charges_current: 0, charges_max: 0, charges_recharge: '' }),
  },
]

export default function EquipmentSection({ control, register, watch, setValue, readOnly, onEditingChange }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'equipment' })

  const [expanded, setExpanded]   = useState(new Set())
  const [editing, setEditing]     = useState(new Set())

  useEffect(() => {
    onEditingChange?.(editing.size > 0)
  }, [editing.size])
  const prevLen                   = useRef(0)
  const pendingNewItem            = useRef(false)

  // Only open edit mode when the user explicitly clicks "Add", not on initial load
  useEffect(() => {
    if (pendingNewItem.current && fields.length > prevLen.current) {
      const id = fields[fields.length - 1].id
      setEditing(p => new Set([...p, id]))
      setExpanded(p => new Set([...p, id]))
      pendingNewItem.current = false
    }
    prevLen.current = fields.length
  }, [fields.length])

  // Modals
  const [useModal,          setUseModal]          = useState(null)  // { index, name, isCharge? }
  const [zeroModal,         setZeroModal]         = useState(null)  // { index, name }
  const [chargesEmptyModal, setChargesEmptyModal] = useState(null)  // { name }
  const [attuneModal,       setAttuneModal]       = useState(null)  // { names: [] }
  const [equipModal,        setEquipModal]        = useState(null)  // { isShield, existingName, newName }

  // Property add form
  const [propFormFor, setPropFormFor] = useState(null)  // field.id or null
  const [propName,    setPropName]    = useState('')
  const [propExtra,   setPropExtra]   = useState('')

  const allEquip    = watch('equipment') || []
  const attunedList = allEquip.map((item, i) => ({ ...item, i })).filter(x => x.attuned)

  const charStats = {
    strength:          watch('strength'),
    dexterity:         watch('dexterity'),
    constitution:      watch('constitution'),
    intelligence:      watch('intelligence'),
    wisdom:            watch('wisdom'),
    charisma:          watch('charisma'),
    proficiency_bonus: watch('proficiency_bonus'),
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  function toggleExpand(fid) {
    setExpanded(p => { const n = new Set(p); n.has(fid) ? n.delete(fid) : n.add(fid); return n })
  }
  function startEdit(fid) {
    setEditing(p => new Set([...p, fid]))
    setExpanded(p => new Set([...p, fid]))
  }
  function stopEdit(fid) {
    setEditing(p => { const n = new Set(p); n.delete(fid); return n })
  }
  function doRemove(i) {
    const fid = fields[i].id
    setEditing(p => { const n = new Set(p); n.delete(fid); return n })
    setExpanded(p => { const n = new Set(p); n.delete(fid); return n })
    if (propFormFor === fid) setPropFormFor(null)
    remove(i)
  }
  function adjustAmount(i, delta) {
    const curr = parseInt(watch(`equipment.${i}.amount`)) || 0
    setValue(`equipment.${i}.amount`, String(Math.max(0, curr + delta)), { shouldDirty: true })
  }
  function handleAttune(i) {
    const isAttuned = allEquip[i]?.attuned
    if (!isAttuned && attunedList.length >= 3) {
      setAttuneModal({ names: attunedList.map(x => x.name || 'Unnamed') })
      return
    }
    setValue(`equipment.${i}.attuned`, !isAttuned, { shouldDirty: true })
  }
  function computeAC(equipList) {
    const armor  = equipList.find(x => x.type === 'armor' && x.equipped && x.armor_category !== 'shield')
    const shield = equipList.find(x => x.type === 'armor' && x.equipped && x.armor_category === 'shield')
    const dexMod = Math.floor(((charStats.dexterity ?? 10) - 10) / 2)
    let ac = 10 + dexMod
    if (armor?.ac_formula) {
      const v = Number(evalFormula(armor.ac_formula, charStats))
      if (!isNaN(v) && isFinite(v)) ac = v
    }
    if (shield?.ac_formula) {
      const v = Number(evalFormula(shield.ac_formula, charStats))
      if (!isNaN(v) && isFinite(v)) ac += v
    }
    return ac
  }
  function handleEquip(i) {
    const item     = allEquip[i]
    const isShield = item.armor_category === 'shield'
    const willEquip = !item.equipped
    if (willEquip) {
      const conflict = allEquip.find((x, idx) =>
        idx !== i && x.type === 'armor' && x.equipped &&
        (isShield ? x.armor_category === 'shield' : x.armor_category !== 'shield')
      )
      if (conflict) {
        setEquipModal({ isShield, existingName: conflict.name || 'Unnamed', newName: item.name || 'Unnamed' })
        return
      }
    }
    const updatedEquip = allEquip.map((x, idx) => idx === i ? { ...x, equipped: willEquip } : x)
    setValue(`equipment.${i}.equipped`, willEquip, { shouldDirty: true })
    setValue('armor_class', computeAC(updatedEquip), { shouldDirty: true })
  }
  function handleUseClick(i) {
    setUseModal({ index: i, name: allEquip[i]?.name || 'this item', isCharge: false })
  }
  function handleChargeClick(i) {
    const name = allEquip[i]?.name || 'this item'
    const curr = parseInt(watch(`equipment.${i}.charges_current`)) || 0
    if (curr <= 0) { setChargesEmptyModal({ name }); return }
    setUseModal({ index: i, name, isCharge: true })
  }
  function confirmUse() {
    const { index, isCharge } = useModal
    setUseModal(null)
    if (isCharge) {
      const curr = parseInt(watch(`equipment.${index}.charges_current`)) || 0
      const next = Math.max(0, curr - 1)
      setValue(`equipment.${index}.charges_current`, next, { shouldDirty: true })
      if (next <= 0) setChargesEmptyModal({ name: allEquip[index]?.name || 'this item' })
    } else {
      const next = (parseInt(watch(`equipment.${index}.amount`)) || 0) - 1
      if (next <= 0) {
        setValue(`equipment.${index}.amount`, '0', { shouldDirty: true })
        setZeroModal({ index, name: allEquip[index]?.name || 'this item' })
      } else {
        setValue(`equipment.${index}.amount`, String(next), { shouldDirty: true })
      }
    }
  }

  // Property helpers
  const selPropDef = WEAPON_PROPERTIES.find(p => p.name === propName)
  function openPropForm(fid) { setPropFormFor(fid); setPropName(''); setPropExtra('') }
  function addProp(i) {
    if (!propName) return
    const curr = watch(`equipment.${i}.properties`) || []
    if (curr.some(p => p.name === propName)) return
    setValue(`equipment.${i}.properties`, [...curr, { name: propName, extra: propExtra }], { shouldDirty: true })
    if (propName === 'Finesse') {
      const swapStrDex = s => (s || '').replace(/\bstr\b/gi, m =>
        m === m.toUpperCase() ? 'DEX' : m[0] === m[0].toUpperCase() ? 'Dex' : 'dex'
      )
      setValue(`equipment.${i}.finesse_attack_modifier`, swapStrDex(watch(`equipment.${i}.attack_modifier`)), { shouldDirty: true })
      setValue(`equipment.${i}.finesse_damage_roll`,     swapStrDex(watch(`equipment.${i}.damage_roll`)),     { shouldDirty: true })
    }
    setPropFormFor(null); setPropName(''); setPropExtra('')
  }
  function handleFinesse(i) {
    setValue(`equipment.${i}.finesse_active`, !allEquip[i]?.finesse_active, { shouldDirty: true })
  }
  function handleVersatile(i) {
    setValue(`equipment.${i}.versatile_active`, !allEquip[i]?.versatile_active, { shouldDirty: true })
  }
  function removeProp(i, name) {
    const curr = watch(`equipment.${i}.properties`) || []
    setValue(`equipment.${i}.properties`, curr.filter(p => p.name !== name), { shouldDirty: true })
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Currency */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { key: 'copper',   label: 'CP', box: 'bg-orange-950 border-orange-700', lbl: 'text-orange-400', inp: 'text-orange-200' },
          { key: 'silver',   label: 'SP', box: 'bg-slate-800  border-slate-500',  lbl: 'text-slate-300',  inp: 'text-slate-100' },
          { key: 'electrum', label: 'EP', box: 'bg-purple-950 border-purple-700', lbl: 'text-purple-400', inp: 'text-purple-200' },
          { key: 'gold',     label: 'GP', box: 'bg-yellow-950 border-yellow-700', lbl: 'text-yellow-400', inp: 'text-yellow-200' },
          { key: 'platinum', label: 'PP', box: 'bg-slate-700  border-slate-400',  lbl: 'text-slate-200',  inp: 'text-white'     },
        ].map(({ key, label, box, lbl, inp }) => (
          <div key={key} className={`border rounded-lg p-2 text-center ${box}`}>
            <div className={`text-xs font-semibold mb-1 ${lbl}`}>{label}</div>
            <input type="number" min={0} {...register(key, { valueAsNumber: true })}
              className={`no-spinner bg-transparent border-0 text-center w-full p-0 text-sm font-medium focus:outline-none ${inp}`}
              disabled={readOnly} />
          </div>
        ))}
      </div>

      {/* 4 category sections */}
      {CATEGORIES.map(cat => {
        const catItems = fields
          .map((f, i) => ({ field: f, i }))
          .filter(({ i }) => (allEquip[i]?.type || 'misc') === cat.type)

        return (
          <div key={cat.type} className="mb-4">
            <div className={`flex items-center justify-between text-xs font-semibold uppercase tracking-wider ${cat.color} mb-1.5`}>
              <span>{cat.label}</span>
              {!readOnly && (
                <button type="button" onClick={() => { pendingNewItem.current = true; append(cat.mkDefault()) }}
                  className="btn btn-secondary btn-sm py-0.5 text-xs normal-case tracking-normal font-normal">
                  <PlusIcon className="w-3 h-3 mr-1" /> Add
                </button>
              )}
            </div>

            <div className="space-y-1">
              {catItems.length === 0 && (
                <p className="text-stone-600 text-xs italic px-1">None.</p>
              )}

              {catItems.map(({ field, i }) => {
                const isExpanded = expanded.has(field.id)
                const isEditing  = editing.has(field.id)
                const item       = allEquip[i] || {}
                const props      = item.properties || []

                return (
                  <div key={field.id} className="bg-stone-800 border border-stone-700 rounded-lg overflow-hidden">

                    {/* ── EDIT MODE ─────────────────────────────────────── */}
                    {isEditing && !readOnly ? (
                      <div className="p-2 space-y-2">
                        {/* Base row */}
                        <div className="flex gap-2 flex-wrap items-center">
                          <input {...register(`equipment.${i}.name`)} className="input flex-1 min-w-32"
                            placeholder="Name" autoFocus={!item.name} />
                          <input {...register(`equipment.${i}.price`)} className="input w-24" placeholder="Price" />
                          <div className="flex items-center shrink-0">
                            <button type="button" onClick={() => adjustAmount(i, -1)}
                              className="px-2 py-2 bg-stone-700 hover:bg-stone-600 rounded-l-lg text-stone-200 text-sm leading-none">−</button>
                            <input {...register(`equipment.${i}.amount`)} className="input w-12 rounded-none text-center px-1" placeholder="1" />
                            <button type="button" onClick={() => adjustAmount(i, 1)}
                              className="px-2 py-2 bg-stone-700 hover:bg-stone-600 rounded-r-lg text-stone-200 text-sm leading-none">+</button>
                          </div>
                          <button type="button" onClick={() => stopEdit(field.id)}
                            className="text-green-400 hover:text-green-300 p-1.5 rounded hover:bg-stone-700 shrink-0" title="Done">
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => doRemove(i)}
                            className="text-stone-500 hover:text-red-400 p-1.5 rounded hover:bg-stone-700 shrink-0">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Weapon fields */}
                        {cat.type === 'weapon' && (
                          <div className="space-y-2">
                            <div className="flex gap-2 flex-wrap">
                              <select {...register(`equipment.${i}.weapon_class`, {
                                onChange: () => setValue(`equipment.${i}.weapon_specific`, '', { shouldDirty: true })
                              })} className="input w-28">
                                {WEAPON_CLASS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>
                              <select {...register(`equipment.${i}.weapon_range`, {
                                onChange: () => setValue(`equipment.${i}.weapon_specific`, '', { shouldDirty: true })
                              })} className="input w-28">
                                {WEAPON_RANGE.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                              <select {...register(`equipment.${i}.weapon_specific`)} className="input w-44">
                                <option value="">— type —</option>
                                {(WEAPON_SPECIFIC[`${item.weapon_class || 'simple'}-${item.weapon_range || 'melee'}`] || []).map(w => (
                                  <option key={w} value={w}>{w}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <input {...register(`equipment.${i}.attack_modifier`)} className="input flex-1 min-w-36"
                                placeholder="Attack modifier (e.g. STR+prof)" />
                              <input {...register(`equipment.${i}.damage_roll`)} className="input flex-1 min-w-36"
                                placeholder="Damage roll (e.g. 1d8+STR[slashing])" />
                            </div>
                            {props.some(p => p.name === 'Finesse') && (
                              <div className="flex gap-2 flex-wrap items-center">
                                <span className="text-xs text-green-400 shrink-0 w-16">Finesse:</span>
                                <input {...register(`equipment.${i}.finesse_attack_modifier`)} className="input flex-1 min-w-36"
                                  placeholder="Finesse attack (e.g. DEX+prof)" />
                                <input {...register(`equipment.${i}.finesse_damage_roll`)} className="input flex-1 min-w-36"
                                  placeholder="Finesse damage (e.g. 1d8+DEX[slashing])" />
                              </div>
                            )}
                            {/* Properties */}
                            <div>
                              <div className="flex flex-wrap gap-1 mb-1 items-center">
                                {props.map(p => (
                                  <span key={p.name} className="inline-flex items-center gap-1 text-xs bg-stone-700 text-stone-300 px-2 py-0.5 rounded">
                                    {p.extra ? `${p.name} (${p.extra})` : p.name}
                                    <button type="button" onClick={() => removeProp(i, p.name)} className="text-stone-500 hover:text-red-400">
                                      <XMarkIcon className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                                {propFormFor !== field.id && (
                                  <button type="button" onClick={() => openPropForm(field.id)}
                                    className="text-xs text-stone-400 hover:text-stone-200 px-2 py-0.5 border border-dashed border-stone-600 rounded hover:border-stone-400">
                                    + Property
                                  </button>
                                )}
                              </div>
                              {propFormFor === field.id && (
                                <div className="flex gap-2 flex-wrap items-end">
                                  <select value={propName} onChange={e => { setPropName(e.target.value); setPropExtra('') }} className="input w-40">
                                    <option value="">Select…</option>
                                    {WEAPON_PROPERTIES
                                      .filter(p => !props.some(ex => ex.name === p.name))
                                      .map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                  </select>
                                  {selPropDef?.extraType && (
                                    <input value={propExtra} onChange={e => setPropExtra(e.target.value)}
                                      className="input w-44" placeholder={selPropDef.extraLabel} />
                                  )}
                                  <button type="button" onClick={() => addProp(i)}
                                    className="btn btn-secondary btn-sm" disabled={!propName}>Add</button>
                                  <button type="button" onClick={() => setPropFormFor(null)}
                                    className="btn btn-secondary btn-sm">Cancel</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Armor fields */}
                        {cat.type === 'armor' && (
                          <div className="flex gap-2 flex-wrap">
                            <select {...register(`equipment.${i}.armor_category`)} className="input w-36">
                              {ARMOR_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <input {...register(`equipment.${i}.ac_formula`)} className="input flex-1 min-w-36"
                              placeholder="AC formula (e.g. 16, 13+DEX, +2)" />
                          </div>
                        )}

                        {/* Charges (non-usable) */}
                        {cat.type !== 'usable' && (
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="flex items-center gap-1.5 text-sm text-stone-400 cursor-pointer select-none">
                              <input type="checkbox" {...register(`equipment.${i}.has_charges`)} className="accent-red-700 w-4 h-4" />
                              Has charges
                            </label>
                            {item.has_charges && (
                              <>
                                <div className="flex items-center gap-1 text-stone-400 text-sm">
                                  <input type="number" min={0}
                                    {...register(`equipment.${i}.charges_current`, {
                                      valueAsNumber: true,
                                      onChange: e => {
                                        const max = parseInt(watch(`equipment.${i}.charges_max`)) || 0
                                        const val = parseInt(e.target.value) || 0
                                        if (val > max) setValue(`equipment.${i}.charges_current`, max, { shouldDirty: true })
                                      }
                                    })}
                                    className="input w-16 text-center" placeholder="0" />
                                  <span>/</span>
                                  <input type="number" min={1}
                                    {...register(`equipment.${i}.charges_max`, {
                                      valueAsNumber: true,
                                      onChange: e => {
                                        const max = parseInt(e.target.value) || 0
                                        const cur = parseInt(watch(`equipment.${i}.charges_current`)) || 0
                                        if (cur > max) setValue(`equipment.${i}.charges_current`, max, { shouldDirty: true })
                                      }
                                    })}
                                    className="input w-16 text-center" placeholder="1" />
                                </div>
                                <select {...register(`equipment.${i}.charges_recharge`)} className="input w-36">
                                  <option value="">— recharge —</option>
                                  <option value="short">Short Rest</option>
                                  <option value="long">Long Rest</option>
                                </select>
                              </>
                            )}
                          </div>
                        )}

                        {/* Description */}
                        <textarea {...register(`equipment.${i}.description`)} className="input w-full resize-none"
                          rows={3} placeholder="Description (optional)" style={{ whiteSpace: 'pre-wrap' }} />
                      </div>

                    ) : (
                    /* ── VIEW MODE ──────────────────────────────────────── */
                      <div>
                        <div className="flex flex-col px-2 py-2 cursor-pointer select-none"
                          onClick={() => toggleExpand(field.id)}>

                          {/* Primary row: chevron + name + action buttons */}
                          <div className="flex items-center gap-1.5">
                            <ChevronDownIcon className={`w-4 h-4 text-stone-500 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                            <span className="flex-1 text-stone-100 text-sm font-medium truncate min-w-0">
                              {item.name || <span className="text-stone-500 italic">Unnamed</span>}
                            </span>

                            {/* Equip (armor only) */}
                            {cat.type === 'armor' && (
                              <button type="button"
                                onClick={e => { e.stopPropagation(); if (!readOnly) handleEquip(i) }}
                                className={`btn btn-sm py-0.5 px-2 text-xs shrink-0 ${
                                  item.equipped
                                    ? 'bg-blue-900 text-blue-200 border border-blue-700 hover:bg-blue-800'
                                    : 'btn-secondary text-stone-400'
                                } ${readOnly ? 'opacity-50 cursor-default' : ''}`}>
                                {item.equipped ? 'Equipped' : 'Equip'}
                              </button>
                            )}

                            {/* Attune */}
                            <button type="button"
                              onClick={e => { e.stopPropagation(); handleAttune(i) }}
                              title={item.attuned ? 'Attuned — click to unattune' : 'Not attuned — click to attune'}
                              className={`p-1 rounded shrink-0 transition-colors ${item.attuned ? 'text-yellow-400 hover:text-yellow-300' : 'text-stone-600 hover:text-stone-400'}`}>
                              <SparklesIcon className="w-4 h-4" />
                            </button>

                            {/* Use button (usables) */}
                            {cat.type === 'usable' && !readOnly && (
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handleUseClick(i) }}
                                className="btn btn-secondary btn-sm py-0.5 px-2 text-xs shrink-0 text-green-300 border-green-800 hover:bg-green-900/40">
                                Use
                              </button>
                            )}

                            {/* Charges Use button */}
                            {cat.type !== 'usable' && item.has_charges && !readOnly && (
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handleChargeClick(i) }}
                                className="btn btn-secondary btn-sm py-0.5 px-2 text-xs shrink-0 text-purple-300 border-purple-800 hover:bg-purple-900/40">
                                Use
                              </button>
                            )}

                            {!readOnly && (
                              <>
                                <button type="button" onClick={e => { e.stopPropagation(); startEdit(field.id) }}
                                  className="text-stone-500 hover:text-stone-300 p-1 rounded hover:bg-stone-700 shrink-0">
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={e => { e.stopPropagation(); doRemove(i) }}
                                  className="text-stone-500 hover:text-red-400 p-1 rounded hover:bg-stone-700 shrink-0">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>

                          {/* Info row: stats, charges, price, amount — wraps on small screens */}
                          {(
                            (cat.type === 'weapon' && (item.attack_modifier || item.damage_roll)) ||
                            (cat.type === 'armor' && item.ac_formula) ||
                            item.price || item.amount ||
                            (cat.type !== 'usable' && item.has_charges)
                          ) && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 ml-5 mt-1 text-xs text-stone-400">
                              {cat.type === 'weapon' && item.attack_modifier && (
                                <span><span className="text-stone-500">Att:</span> {evalFormula(item.finesse_active && item.finesse_attack_modifier ? item.finesse_attack_modifier : item.attack_modifier, charStats)}</span>
                              )}
                              {cat.type === 'weapon' && item.damage_roll && (() => {
                                const versatileProp = (item.properties || []).find(p => p.name === 'Versatile')
                                const effectiveDmg = item.versatile_active && versatileProp?.extra ? versatileProp.extra : (item.finesse_active && item.finesse_damage_roll ? item.finesse_damage_roll : item.damage_roll)
                                return <span><span className="text-stone-500">Dmg:</span> {evalFormula(effectiveDmg, charStats)}</span>
                              })()}
                              {cat.type === 'armor' && item.ac_formula && (
                                <span><span className="text-stone-500">AC:</span> {evalFormula(item.ac_formula, charStats)}</span>
                              )}
                              {item.price && <span className="text-stone-500">{item.price}</span>}
                              {item.amount && <span>×{item.amount}</span>}
                              {cat.type !== 'usable' && item.has_charges && (
                                <>
                                  <span>{item.charges_current ?? 0}/{item.charges_max ?? 0} charges</span>
                                  {(item.charges_recharge === 'short' || item.charges_recharge === 'long') && (
                                    <span className="text-stone-500">
                                      ({item.charges_recharge === 'short' ? 'Short Rest' : 'Long Rest'})
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-stone-700 pt-2 space-y-2">
                            {/* Weapon details */}
                            {cat.type === 'weapon' && (
                              <>
                                <div className="flex flex-wrap gap-2 items-center">
                                  {(item.weapon_class || item.weapon_type) && (
                                    <span className="text-xs bg-red-950 text-red-300 border border-red-900 px-2 py-0.5 rounded">
                                      {item.weapon_class
                                        ? `${item.weapon_class === 'simple' ? 'Simple' : 'Martial'} ${item.weapon_range === 'ranged' ? 'Ranged' : 'Melee'}`
                                        : WEAPON_TYPES.find(t => t.value === item.weapon_type)?.label}
                                    </span>
                                  )}
                                  {item.weapon_specific && (
                                    <span className="text-xs bg-stone-700 text-stone-300 border border-stone-600 px-2 py-0.5 rounded">
                                      {item.weapon_specific}
                                    </span>
                                  )}
                                  {item.attack_modifier && (
                                    <span className="text-stone-400 text-sm">Att: <span className="text-stone-200">{evalFormula(item.finesse_active && item.finesse_attack_modifier ? item.finesse_attack_modifier : item.attack_modifier, charStats)}</span></span>
                                  )}
                                  {item.damage_roll && (() => {
                                    const versatileProp = props.find(p => p.name === 'Versatile')
                                    const effectiveDmg = item.versatile_active && versatileProp?.extra ? versatileProp.extra : (item.finesse_active && item.finesse_damage_roll ? item.finesse_damage_roll : item.damage_roll)
                                    return <span className="text-stone-400 text-sm">Dmg: <span className="text-stone-200">{evalFormula(effectiveDmg, charStats)}</span></span>
                                  })()}
                                </div>
                                {props.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {props.map(p => {
                                      if (p.name === 'Finesse') return (
                                        <button key={p.name} type="button"
                                          onClick={() => !readOnly && handleFinesse(i)}
                                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${item.finesse_active ? 'bg-green-900 text-green-300 border-green-700' : 'bg-stone-700 text-stone-300 border-stone-600'} ${readOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}>
                                          {p.extra ? `Finesse (${p.extra})` : 'Finesse'}
                                        </button>
                                      )
                                      if (p.name === 'Versatile') return (
                                        <button key={p.name} type="button"
                                          onClick={() => !readOnly && handleVersatile(i)}
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
                              </>
                            )}

                            {/* Armor details */}
                            {cat.type === 'armor' && (
                              <div className="flex flex-wrap gap-2 items-center">
                                {item.armor_category && (
                                  <span className="text-xs bg-blue-950 text-blue-300 border border-blue-900 px-2 py-0.5 rounded">
                                    {ARMOR_CATEGORIES.find(c => c.value === item.armor_category)?.label}
                                  </span>
                                )}
                                {item.ac_formula && (
                                  <span className="text-stone-400 text-sm">AC: <span className="text-stone-200">{evalFormula(item.ac_formula, charStats)}</span></span>
                                )}
                              </div>
                            )}

                            {/* Description */}
                            {item.description
                              ? <p className="text-stone-300 text-sm whitespace-pre-wrap">{item.description}</p>
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
          </div>
        )
      })}

      {/* Modals */}
      <Modal open={!!useModal} title="Use item?"
        onConfirm={confirmUse} onCancel={() => setUseModal(null)} confirmLabel="Use">
        Use <strong>{useModal?.name}</strong>?
      </Modal>

      <Modal open={!!zeroModal} title="Item depleted" danger
        onConfirm={() => { doRemove(zeroModal.index); setZeroModal(null) }}
        onCancel={() => setZeroModal(null)}
        confirmLabel="Delete" cancelLabel="Keep at 0">
        <strong>{zeroModal?.name}</strong> has reached 0. Delete it?
      </Modal>

      <Modal open={!!chargesEmptyModal} title="No charges remaining" onCancel={() => setChargesEmptyModal(null)}>
        <strong>{chargesEmptyModal?.name}</strong> has no charges remaining.
      </Modal>

      <Modal open={!!attuneModal} title="Already attuned to 3 items" onCancel={() => setAttuneModal(null)}>
        <ul className="list-disc list-inside space-y-1 mt-1">
          {attuneModal?.names.map((n, i) => <li key={i} className="text-stone-200">{n}</li>)}
        </ul>
      </Modal>

      <Modal
        open={!!equipModal}
        title={equipModal?.isShield ? 'Shield already equipped' : 'Armor already equipped'}
        onCancel={() => setEquipModal(null)}>
        <p className="text-stone-300 mt-1">
          {equipModal?.isShield
            ? <>Already carrying <strong className="text-stone-100">{equipModal?.existingName}</strong>.<br />Unequip it before equipping <strong className="text-stone-100">{equipModal?.newName}</strong>.</>
            : <>Already wearing <strong className="text-stone-100">{equipModal?.existingName}</strong>.<br />Remove it before equipping <strong className="text-stone-100">{equipModal?.newName}</strong>.</>
          }
        </p>
      </Modal>
    </div>
  )
}
