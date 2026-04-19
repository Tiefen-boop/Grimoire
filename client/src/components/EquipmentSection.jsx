import { useState, useEffect, useRef } from 'react'
import { useFieldArray } from 'react-hook-form'
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, ChevronDownIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Modal from './Modal'

const WEAPON_TYPES = [
  { value: 'simple-melee',   label: 'Simple Melee' },
  { value: 'simple-ranged',  label: 'Simple Ranged' },
  { value: 'martial-melee',  label: 'Martial Melee' },
  { value: 'martial-ranged', label: 'Martial Ranged' },
]

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
    mkDefault: () => ({ name: '', price: '', amount: '1', description: '', type: 'weapon', attuned: false, weapon_type: 'simple-melee', attack_modifier: '', damage_roll: '', properties: [] }),
  },
  {
    type: 'armor', label: 'Armor', color: 'text-blue-400',
    mkDefault: () => ({ name: '', price: '', amount: '1', description: '', type: 'armor', attuned: false, armor_category: 'light', ac_formula: '' }),
  },
  {
    type: 'usable', label: 'Usables', color: 'text-green-400',
    mkDefault: () => ({ name: '', price: '', amount: '1', description: '', type: 'usable', attuned: false }),
  },
  {
    type: 'misc', label: 'Misc', color: 'text-stone-400',
    mkDefault: () => ({ name: '', price: '', amount: '1', description: '', type: 'misc', attuned: false }),
  },
]

export default function EquipmentSection({ control, register, watch, setValue, readOnly }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'equipment' })

  const [expanded, setExpanded]   = useState(new Set())
  const [editing, setEditing]     = useState(new Set())
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
  const [useModal,    setUseModal]    = useState(null)  // { index, name }
  const [zeroModal,   setZeroModal]   = useState(null)  // { index, name }
  const [attuneModal, setAttuneModal] = useState(null)  // { names: [] }

  // Property add form
  const [propFormFor, setPropFormFor] = useState(null)  // field.id or null
  const [propName,    setPropName]    = useState('')
  const [propExtra,   setPropExtra]   = useState('')

  const allEquip    = watch('equipment') || []
  const attunedList = allEquip.map((item, i) => ({ ...item, i })).filter(x => x.attuned)

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
  function handleUseClick(i) {
    setUseModal({ index: i, name: allEquip[i]?.name || 'this item' })
  }
  function confirmUse() {
    const { index } = useModal
    const next = (parseInt(watch(`equipment.${index}.amount`)) || 0) - 1
    setUseModal(null)
    if (next <= 0) {
      setValue(`equipment.${index}.amount`, '0', { shouldDirty: true })
      setZeroModal({ index, name: allEquip[index]?.name || 'this item' })
    } else {
      setValue(`equipment.${index}.amount`, String(next), { shouldDirty: true })
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
    setPropFormFor(null); setPropName(''); setPropExtra('')
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
                              <select {...register(`equipment.${i}.weapon_type`)} className="input w-40">
                                {WEAPON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                              <input {...register(`equipment.${i}.attack_modifier`)} className="input flex-1 min-w-36"
                                placeholder="Attack modifier (e.g. STR+prof)" />
                              <input {...register(`equipment.${i}.damage_roll`)} className="input flex-1 min-w-36"
                                placeholder="Damage roll (e.g. 1d8+STR[slashing])" />
                            </div>
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

                        {/* Description */}
                        <textarea {...register(`equipment.${i}.description`)} className="input w-full resize-none"
                          rows={3} placeholder="Description (optional)" style={{ whiteSpace: 'pre-wrap' }} />
                      </div>

                    ) : (
                    /* ── VIEW MODE ──────────────────────────────────────── */
                      <div>
                        <div className="flex items-center gap-1.5 px-2 py-2 cursor-pointer select-none"
                          onClick={() => toggleExpand(field.id)}>
                          <ChevronDownIcon className={`w-4 h-4 text-stone-500 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />

                          <span className="flex-1 text-stone-100 text-sm font-medium truncate min-w-0">
                            {item.name || <span className="text-stone-500 italic">Unnamed</span>}
                          </span>

                          {/* Type-specific inline hints */}
                          {cat.type === 'weapon' && item.attack_modifier && (
                            <span className="text-stone-500 text-xs shrink-0 hidden sm:block">{item.attack_modifier}</span>
                          )}
                          {cat.type === 'weapon' && item.damage_roll && (
                            <span className="text-stone-400 text-xs shrink-0 hidden sm:block">{item.damage_roll}</span>
                          )}
                          {cat.type === 'armor' && item.ac_formula && (
                            <span className="text-stone-400 text-xs shrink-0">AC: {item.ac_formula}</span>
                          )}
                          {item.price && <span className="text-stone-500 text-xs shrink-0">{item.price}</span>}
                          {item.amount && <span className="text-stone-400 text-xs shrink-0">×{item.amount}</span>}

                          {/* Attune */}
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleAttune(i) }}
                            title={item.attuned ? 'Attuned — click to unattune' : 'Not attuned — click to attune'}
                            className={`p-1 rounded shrink-0 transition-colors ${item.attuned ? 'text-yellow-400 hover:text-yellow-300' : 'text-stone-600 hover:text-stone-400'}`}>
                            <SparklesIcon className="w-4 h-4" />
                          </button>

                          {/* Use button (usables only) */}
                          {cat.type === 'usable' && !readOnly && (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); handleUseClick(i) }}
                              className="btn btn-secondary btn-sm py-0.5 px-2 text-xs shrink-0 text-green-300 border-green-800 hover:bg-green-900/40">
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

                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-stone-700 pt-2 space-y-2">
                            {/* Weapon details */}
                            {cat.type === 'weapon' && (
                              <>
                                <div className="flex flex-wrap gap-2 items-center">
                                  {item.weapon_type && (
                                    <span className="text-xs bg-red-950 text-red-300 border border-red-900 px-2 py-0.5 rounded">
                                      {WEAPON_TYPES.find(t => t.value === item.weapon_type)?.label}
                                    </span>
                                  )}
                                  {item.attack_modifier && (
                                    <span className="text-stone-400 text-sm">Hit: <span className="text-stone-200">{item.attack_modifier}</span></span>
                                  )}
                                  {item.damage_roll && (
                                    <span className="text-stone-400 text-sm">Dmg: <span className="text-stone-200">{item.damage_roll}</span></span>
                                  )}
                                </div>
                                {props.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {props.map(p => (
                                      <span key={p.name} className="text-xs bg-stone-700 text-stone-300 px-2 py-0.5 rounded">
                                        {p.extra ? `${p.name} (${p.extra})` : p.name}
                                      </span>
                                    ))}
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
                                  <span className="text-stone-400 text-sm">AC: <span className="text-stone-200">{item.ac_formula}</span></span>
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

      <Modal open={!!attuneModal} title="Already attuned to 3 items" onCancel={() => setAttuneModal(null)}>
        <ul className="list-disc list-inside space-y-1 mt-1">
          {attuneModal?.names.map((n, i) => <li key={i} className="text-stone-200">{n}</li>)}
        </ul>
      </Modal>
    </div>
  )
}
