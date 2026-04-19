import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { PlusIcon, TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

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
const CONDITIONS = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious']

function mod(score) {
  return Math.floor((score - 10) / 2)
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

export default function CharacterSheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isNew = !id

  const { register, control, handleSubmit, watch, reset, setValue, formState: { isDirty, isSubmitting } } = useForm({
    defaultValues: {
      name: '', class: '', subclass: '', level: 1, race: '', background: '', alignment: '', experience_points: 0,
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
      spellcasting_ability: '', spell_save_dc: 0, spell_attack_bonus: 0,
      spell_slots: {}, spells: [],
      character_backstory: '', allies_and_organizations: '',
      additional_features_and_traits: '', treasure: '',
      age: '', height: '', weight: '', eyes: '', skin: '', hair: '', appearance_notes: '',
      passive_perception: 10, conditions: [], notes: '',
    }
  })

  const { fields: attackFields, append: addAttack, remove: removeAttack } = useFieldArray({ control, name: 'attacks' })
  const { fields: equipFields, append: addEquip, remove: removeEquip } = useFieldArray({ control, name: 'equipment' })
  const { fields: spellFields, append: addSpell, remove: removeSpell } = useFieldArray({ control, name: 'spells' })

  const [loading, setLoading] = useState(!isNew)
  const [readOnly, setReadOnly] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const watchedAbilities = watch(ABILITIES)
  const watchedProfs = watch('saving_throw_profs') || []
  const watchedSkillProfs = watch('skill_profs') || []
  const watchedSkillExp = watch('skill_expertise') || []
  const watchedProfBonus = watch('proficiency_bonus') || 2

  useEffect(() => {
    if (isNew) return
    api.get(`/characters/${id}`)
      .then(r => {
        const data = r.data
        // flatten spell_slots to form-friendly shape
        reset(data)
        // check if current user owns it
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
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        reset(data)
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
          {saved && <span className="text-green-400 text-sm">Saved!</span>}
          {!readOnly && (
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          )}
          <button type="button" onClick={() => navigate('/characters')} className="btn btn-secondary">
            Back
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Character Name</label>
            <input {...register('name')} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Class</label>
            <input {...register('class')} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Subclass</label>
            <input {...register('subclass')} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Level</label>
            <input type="number" min={1} max={20} {...register('level', { valueAsNumber: true })} className="input" disabled={readOnly} />
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
          <div>
            <label className="label">Experience Points</label>
            <input type="number" min={0} {...register('experience_points', { valueAsNumber: true })} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Proficiency Bonus</label>
            <input type="number" {...register('proficiency_bonus', { valueAsNumber: true })} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Inspiration</label>
            <input type="number" min={0} {...register('inspiration', { valueAsNumber: true })} className="input" disabled={readOnly} />
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

        {/* Saving Throws */}
        <div className="grid grid-cols-2 gap-4">
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

          {/* Passive Perception */}
          <div>
            <div className="label mb-2">Passive Perception</div>
            <input type="number" {...register('passive_perception', { valueAsNumber: true })}
              className="input w-24" disabled={readOnly} />
          </div>
        </div>
      </Section>

      {/* Skills */}
      <Section title="Skills" defaultOpen={false}>
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
        <p className="text-xs text-stone-500 mt-2">Red checkbox = proficient, Yellow = expertise</p>
      </Section>

      {/* Combat */}
      <Section title="Combat">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          {[
            { label: 'AC', name: 'armor_class' },
            { label: 'Initiative', name: 'initiative_bonus' },
            { label: 'Speed', name: 'speed' },
            { label: 'Max HP', name: 'max_hp' },
            { label: 'Current HP', name: 'current_hp' },
            { label: 'Temp HP', name: 'temp_hp' },
          ].map(f => (
            <div key={f.name} className="stat-box">
              <div className="label text-xs text-center">{f.label}</div>
              <input type="number" {...register(f.name, { valueAsNumber: true })}
                className="input text-center text-lg font-bold p-1" disabled={readOnly} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="label">Hit Dice</label>
            <input {...register('hit_dice')} className="input" placeholder="e.g. 5d8" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Hit Dice Remaining</label>
            <input {...register('hit_dice_remaining')} className="input" placeholder="e.g. 3d8" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Death Save Successes</label>
            <input type="number" min={0} max={3} {...register('death_save_successes', { valueAsNumber: true })} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Death Save Failures</label>
            <input type="number" min={0} max={3} {...register('death_save_failures', { valueAsNumber: true })} className="input" disabled={readOnly} />
          </div>
        </div>

        {/* Conditions */}
        <div>
          <div className="label mb-2">Conditions</div>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map(c => {
              const active = (watch('conditions') || []).includes(c)
              return (
                <button
                  key={c} type="button"
                  onClick={() => !readOnly && toggleArrayValue('conditions', c)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
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
        </div>
      </Section>

      {/* Attacks */}
      <Section title="Attacks & Spellcasting" defaultOpen={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mb-2">
            <thead>
              <tr className="text-stone-400 text-left">
                <th className="pb-2 pr-2">Name</th>
                <th className="pb-2 pr-2">Attack Bonus</th>
                <th className="pb-2 pr-2">Damage</th>
                <th className="pb-2 pr-2">Type</th>
                <th className="pb-2 pr-2">Range</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {attackFields.map((field, i) => (
                <tr key={field.id}>
                  <td className="pr-2 pb-1"><input {...register(`attacks.${i}.name`)} className="input" disabled={readOnly} /></td>
                  <td className="pr-2 pb-1"><input {...register(`attacks.${i}.attack_bonus`)} className="input w-20" disabled={readOnly} /></td>
                  <td className="pr-2 pb-1"><input {...register(`attacks.${i}.damage`)} className="input w-20" placeholder="1d6" disabled={readOnly} /></td>
                  <td className="pr-2 pb-1"><input {...register(`attacks.${i}.damage_type`)} className="input w-24" placeholder="Slashing" disabled={readOnly} /></td>
                  <td className="pr-2 pb-1"><input {...register(`attacks.${i}.range`)} className="input w-20" placeholder="5 ft" disabled={readOnly} /></td>
                  <td className="pb-1">
                    {!readOnly && (
                      <button type="button" onClick={() => removeAttack(i)} className="text-stone-500 hover:text-red-400 p-1">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && (
            <button type="button" onClick={() => addAttack({ name: '', attack_bonus: '', damage: '', damage_type: '', range: '' })}
              className="btn btn-secondary btn-sm">
              <PlusIcon className="w-4 h-4 mr-1" /> Add Attack
            </button>
          )}
        </div>
      </Section>

      {/* Equipment & Currency */}
      <Section title="Equipment & Currency" defaultOpen={false}>
        <div className="grid grid-cols-5 gap-3 mb-4">
          {['copper','silver','electrum','gold','platinum'].map(coin => (
            <div key={coin} className="stat-box">
              <div className="label text-xs text-center uppercase">{coin.slice(0,2)}</div>
              <input type="number" min={0} {...register(coin, { valueAsNumber: true })}
                className="input text-center p-1" disabled={readOnly} />
            </div>
          ))}
        </div>
        <div className="space-y-1 mb-2">
          {equipFields.map((field, i) => (
            <div key={field.id} className="flex gap-2">
              <input {...register(`equipment.${i}.name`)} className="input flex-1" placeholder="Item name" disabled={readOnly} />
              <input {...register(`equipment.${i}.quantity`)} className="input w-16" placeholder="Qty" disabled={readOnly} />
              <input {...register(`equipment.${i}.notes`)} className="input flex-1" placeholder="Notes" disabled={readOnly} />
              {!readOnly && (
                <button type="button" onClick={() => removeEquip(i)} className="text-stone-500 hover:text-red-400 p-1">
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <button type="button" onClick={() => addEquip({ name: '', quantity: '1', notes: '' })}
            className="btn btn-secondary btn-sm">
            <PlusIcon className="w-4 h-4 mr-1" /> Add Item
          </button>
        )}
      </Section>

      {/* Spellcasting */}
      <Section title="Spellcasting" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="label">Spellcasting Ability</label>
            <select {...register('spellcasting_ability')} className="input" disabled={readOnly}>
              <option value="">None</option>
              {ABILITIES.map(a => <option key={a} value={a}>{ABILITY_SHORT[a]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Spell Save DC</label>
            <input type="number" {...register('spell_save_dc', { valueAsNumber: true })} className="input" disabled={readOnly} />
          </div>
          <div>
            <label className="label">Spell Attack Bonus</label>
            <input type="number" {...register('spell_attack_bonus', { valueAsNumber: true })} className="input" disabled={readOnly} />
          </div>
        </div>

        {/* Spell slots */}
        <div className="mb-4">
          <div className="label mb-2">Spell Slots</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[1,2,3,4,5,6,7,8,9].map(lvl => (
              <div key={lvl} className="stat-box">
                <div className="label text-xs text-center">Level {lvl}</div>
                <div className="flex gap-1">
                  <input type="number" min={0} {...register(`spell_slots.${lvl}.total`, { valueAsNumber: true })}
                    className="input text-center p-1 text-sm" placeholder="—" disabled={readOnly} />
                  <input type="number" min={0} {...register(`spell_slots.${lvl}.used`, { valueAsNumber: true })}
                    className="input text-center p-1 text-sm" placeholder="—" disabled={readOnly} />
                </div>
                <div className="text-xs text-stone-500 text-center mt-0.5">total / used</div>
              </div>
            ))}
          </div>
        </div>

        {/* Spells list */}
        <div>
          <div className="label mb-2">Spells</div>
          <div className="space-y-1 mb-2">
            {spellFields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <select {...register(`spells.${i}.level`, { valueAsNumber: true })} className="input" disabled={readOnly}>
                  {SPELL_LEVELS.map(l => <option key={l} value={l}>{l === 0 ? 'Cantrip' : `Level ${l}`}</option>)}
                </select>
                <input {...register(`spells.${i}.name`)} className="input" placeholder="Spell name" disabled={readOnly} />
                <input {...register(`spells.${i}.cast_time`)} className="input" placeholder="Cast time" disabled={readOnly} />
                <input {...register(`spells.${i}.range`)} className="input" placeholder="Range" disabled={readOnly} />
                <div className="flex gap-1 items-center">
                  <label className="flex items-center gap-1 text-xs text-stone-400">
                    <input type="checkbox" {...register(`spells.${i}.prepared`)} disabled={readOnly} className="accent-red-700" />
                    Prep
                  </label>
                  {!readOnly && (
                    <button type="button" onClick={() => removeSpell(i)} className="text-stone-500 hover:text-red-400 p-1 ml-auto">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="col-span-2 sm:col-span-5">
                  <input {...register(`spells.${i}.description`)} className="input text-sm" placeholder="Description (optional)" disabled={readOnly} />
                </div>
              </div>
            ))}
          </div>
          {!readOnly && (
            <button type="button"
              onClick={() => addSpell({ level: 1, name: '', cast_time: '', range: '', prepared: false, description: '' })}
              className="btn btn-secondary btn-sm">
              <PlusIcon className="w-4 h-4 mr-1" /> Add Spell
            </button>
          )}
        </div>
      </Section>

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

      {/* Save button at bottom too */}
      {!readOnly && (
        <div className="flex justify-end gap-2 mt-2">
          {error && <span className="text-red-400 text-sm self-center">{error}</span>}
          {saved && <span className="text-green-400 text-sm self-center">Saved!</span>}
          <button type="submit" disabled={isSubmitting} className="btn btn-primary">
            {isSubmitting ? 'Saving…' : isNew ? 'Create Character' : 'Save Changes'}
          </button>
        </div>
      )}
    </form>
  )
}
