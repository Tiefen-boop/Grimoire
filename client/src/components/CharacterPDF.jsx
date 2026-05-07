import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { evalFormula } from '../utils/formulaEval'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: `${window.location.origin}/fonts/Heebo-Regular.ttf` },
    { src: `${window.location.origin}/fonts/Heebo-Bold.ttf`,    fontWeight: 'bold' },
    { src: `${window.location.origin}/fonts/Heebo-Bold.ttf`,    fontWeight: 'bold', fontStyle: 'italic' },
    { src: `${window.location.origin}/fonts/Heebo-Regular.ttf`, fontStyle: 'italic' },
  ],
})

// ── constants ─────────────────────────────────────────────────────────────────

const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const ABILITY_SHORT = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' }

const SKILLS = [
  { name: 'Acrobatics',     ability: 'dexterity'    },
  { name: 'Animal Handling',ability: 'wisdom'       },
  { name: 'Arcana',         ability: 'intelligence' },
  { name: 'Athletics',      ability: 'strength'     },
  { name: 'Deception',      ability: 'charisma'     },
  { name: 'History',        ability: 'intelligence' },
  { name: 'Insight',        ability: 'wisdom'       },
  { name: 'Intimidation',   ability: 'charisma'     },
  { name: 'Investigation',  ability: 'intelligence' },
  { name: 'Medicine',       ability: 'wisdom'       },
  { name: 'Nature',         ability: 'intelligence' },
  { name: 'Perception',     ability: 'wisdom'       },
  { name: 'Performance',    ability: 'charisma'     },
  { name: 'Persuasion',     ability: 'charisma'     },
  { name: 'Religion',       ability: 'intelligence' },
  { name: 'Sleight of Hand',ability: 'dexterity'    },
  { name: 'Stealth',        ability: 'dexterity'    },
  { name: 'Survival',       ability: 'wisdom'       },
]

const SPELL_SLOT_LABELS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

const INVENTORY_CATEGORIES = [
  { type: 'weapon', label: 'Weapons', headerBg: '#5b1a1a', headerText: '#fca5a5' },
  { type: 'armor',  label: 'Armor',   headerBg: '#1e3050', headerText: '#93c5fd' },
  { type: 'usable', label: 'Usables', headerBg: '#14422a', headerText: '#86efac' },
  { type: 'misc',   label: 'Misc',    headerBg: '#2a2520', headerText: '#d6d3d1' },
]

const COIN = [
  { key: 'copper',   label: 'CP', bg: '#78350f', text: '#fef3c7' },
  { key: 'silver',   label: 'SP', bg: '#4b5563', text: '#f3f4f6' },
  { key: 'electrum', label: 'EP', bg: '#1d4ed8', text: '#dbeafe' },
  { key: 'gold',     label: 'GP', bg: '#b45309', text: '#fef3c7' },
  { key: 'platinum', label: 'PP', bg: '#4c1d95', text: '#ede9fe' },
]

// Armor category → proficiency tag (matches CharacterSheet.jsx checkArmorProficiency)
const ARMOR_PROF_MAP = { light: 'Light', medium: 'Medium', heavy: 'Heavy', shield: 'Shield' }

// ── helpers ───────────────────────────────────────────────────────────────────

function mod(score) { return Math.floor(((score ?? 10) - 10) / 2) }
function fmtMod(n)  { return n >= 0 ? `+${n}` : `${n}` }

function fmtAtk(val) {
  const n = Number(val)
  return !isNaN(n) && isFinite(n) && n > 0 ? `+${val}` : String(val)
}

function propLabel(p) {
  return p.extra ? `${p.name} (${p.extra})` : p.name
}

const RTL_RE = /[֐-׿؀-ۿݐ-ݿיִ-﷿ﹰ-﻿]/
function isRTL(str) {
  const m = (str || '').match(/\p{L}/u)
  return m ? RTL_RE.test(m[0]) : false
}
function DirText({ style, children, ...rest }) {
  const text = typeof children === 'string' ? children : ''
  const styleArr = Array.isArray(style) ? style : [style]
  // Split on blank lines — detect RTL per paragraph independently.
  // Within each paragraph split on \n so each Text is one line, avoiding
  // react-pdf's RTL line-break artifact (fires when it wraps a long RTL Text).
  const paragraphs = text.split(/\n\n+/)
  return (
    <View>
      {paragraphs.map((para, pi) => {
        const rtl = isRTL(para)
        const rtlStyle = rtl ? { direction: 'rtl', textAlign: 'right' } : {}
        return (
          <View key={pi} style={pi > 0 ? { marginTop: 4 } : {}}>
            {para.split('\n').map((line, li) => (
              <Text key={li} style={[...styleArr, rtlStyle]} {...rest}>{line || ' '}</Text>
            ))}
          </View>
        )
      })}
    </View>
  )
}
function spellComponents(sp) {
  const parts = [sp.comp_v && 'V', sp.comp_s && 'S', sp.comp_m && 'M'].filter(Boolean)
  if (parts.length === 0) return '—'
  let result = parts.join(', ')
  if (sp.comp_m && sp.comp_m_text) result += ` (${sp.comp_m_text})`
  return result
}

function classLabel(c) {
  const parts = [c.name]
  if (c.subclass) parts.push(c.subclass)
  parts.push(`Lv.${c.level}`)
  return parts.join(' ')
}

// ── palette ───────────────────────────────────────────────────────────────────

const C = {
  bg:        '#ffffff',
  bgAlt:     '#f5f0e8',
  border:    '#c9b99a',
  borderDark:'#7a5c3a',
  text:      '#1a1008',
  textMuted: '#5a4a35',
  accent:    '#7a3b1e',
  accentBg:  '#7a3b1e',
  accentText:'#ffffff',
  subtle:    '#e8dece',
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { backgroundColor: C.bg, padding: 18, fontFamily: 'NotoSans', fontSize: 8, color: C.text },

  row:         { flexDirection: 'row' },
  flex1:       { flex: 1 },
  vspacer:     { height: 5 },

  // header
  headerBox:   { flexDirection: 'row', borderBottom: `2pt solid ${C.borderDark}`, paddingBottom: 6, marginBottom: 6 },
  portrait:    { width: 54, height: 54, borderRadius: 3, marginRight: 8, border: `1pt solid ${C.border}` },
  portraitPh:  { width: 54, height: 54, borderRadius: 3, marginRight: 8, border: `1pt solid ${C.border}`, backgroundColor: C.subtle, justifyContent: 'center', alignItems: 'center' },
  charName:    { fontSize: 18, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.accent, marginBottom: 2 },
  headerMeta:  { fontSize: 7.5, color: C.textMuted, marginBottom: 1.5 },

  // section headers
  secHeader:   { backgroundColor: C.accentBg, color: C.accentText, fontFamily: 'NotoSans', fontWeight: 'bold', fontSize: 7, paddingHorizontal: 5, paddingVertical: 2.5, marginBottom: 4, letterSpacing: 0.6 },

  // boxes
  box:         { borderWidth: 1, borderStyle: 'solid', borderColor: C.border, borderRadius: 2, padding: 3, marginBottom: 3 },
  boxLabel:    { fontSize: 6, color: C.textMuted, fontFamily: 'NotoSans', fontWeight: 'bold', letterSpacing: 0.3, marginBottom: 1 },
  boxValue:    { fontSize: 10, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.text },
  boxValueSm:  { fontSize: 8,  fontFamily: 'NotoSans', fontWeight: 'bold', color: C.text },

  // ability score column
  abilityBox:  { borderWidth: 1, borderStyle: 'solid', borderColor: C.border, borderRadius: 2, alignItems: 'center', paddingVertical: 3, paddingHorizontal: 2, marginBottom: 3, width: 44 },
  abilityLabel:{ fontSize: 6, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.accent, letterSpacing: 0.4 },
  abilityScore:{ fontSize: 11, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.text, marginVertical: 1 },
  abilityMod:  { fontSize: 9,  fontFamily: 'NotoSans', fontWeight: 'bold', color: C.text },

  // combat stat box
  statBox:     { flex: 1, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, borderRadius: 2, alignItems: 'center', paddingVertical: 3, paddingHorizontal: 2, marginRight: 3 },
  statBoxLast: { flex: 1, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, borderRadius: 2, alignItems: 'center', paddingVertical: 3, paddingHorizontal: 2 },
  statLabel:   { fontSize: 6, color: C.textMuted, textAlign: 'center', marginBottom: 1 },
  statValue:   { fontSize: 11, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.text },

  // proficiency list rows
  listRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 1.5 },
  listName:    { flex: 1, fontSize: 7, color: C.text },
  listVal:     { fontSize: 7, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.text, width: 22, textAlign: 'right' },

  // table
  tblHeader:   { flexDirection: 'row', backgroundColor: C.subtle, paddingVertical: 2, paddingHorizontal: 3, borderBottom: `0.5pt solid ${C.border}` },
  tblRow:      { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 3, borderBottom: `0.5pt solid ${C.subtle}` },
  tblCell:     { fontSize: 7, color: C.text },
  tblCellBold: { fontSize: 7, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.text },

  // text
  textBlock:   { fontSize: 7.5, color: C.text, lineHeight: 1.45 },
  fieldLabel:  { fontSize: 6.5, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.textMuted, marginBottom: 1.5, letterSpacing: 0.3 },
  featureName: { fontSize: 8.5, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.accent, marginBottom: 1 },
  featureSource:{ fontSize: 6.5, color: C.textMuted, fontFamily: 'NotoSans', fontStyle: 'italic', marginBottom: 2 },

  // inventory
  coinRow:     { flexDirection: 'row', marginBottom: 10 },
  coinBox:     { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 3, paddingVertical: 6, marginRight: 4 },
  coinBoxLast: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 3, paddingVertical: 6 },
  coinLabel:   { fontSize: 7, fontFamily: 'NotoSans', fontWeight: 'bold' },
  coinValue:   { fontSize: 12, fontFamily: 'NotoSans', fontWeight: 'bold' },
  badge:       { borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1.5, marginRight: 3, marginBottom: 2 },
  badgeText:   { fontSize: 6, fontFamily: 'NotoSans', fontWeight: 'bold' },
  itemName:    { fontSize: 9, fontFamily: 'NotoSans', fontWeight: 'bold', color: C.text },
  itemBlock:   { paddingVertical: 5, borderBottom: `0.5pt solid ${C.subtle}` },
})

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children, style }) {
  return <Text style={[s.secHeader, style]}>{String(children).toUpperCase()}</Text>
}

function CategoryHeader({ label, headerBg, headerText }) {
  return (
    <Text style={[s.secHeader, { backgroundColor: headerBg, color: headerText, marginTop: 6 }]}>
      {label.toUpperCase()}
    </Text>
  )
}

function StatBox({ label, value, last }) {
  return (
    <View style={last ? s.statBoxLast : s.statBox}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  )
}

function ProfCircle({ proficient, expert }) {
  const size = 8
  const r    = size / 2
  if (expert) {
    return (
      <View style={{ width: size, height: size, borderRadius: r, backgroundColor: C.accent, marginRight: 4, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 4.5, color: '#fff', fontFamily: 'NotoSans', fontWeight: 'bold', lineHeight: 1 }}>E</Text>
      </View>
    )
  }
  if (proficient) {
    return <View style={{ width: size, height: size, borderRadius: r, backgroundColor: C.accent, marginRight: 4 }} />
  }
  return <View style={{ width: size, height: size, borderRadius: r, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, marginRight: 4 }} />
}

function SmallCircle({ filled }) {
  return (
    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: filled ? C.accent : 'transparent', borderWidth: 1, borderStyle: 'solid', borderColor: filled ? C.accent : C.border, marginRight: 2 }} />
  )
}

function ListRow({ proficient, expert, name, value, disadvantage, abilitySuffix }) {
  return (
    <View style={s.listRow}>
      <ProfCircle proficient={proficient} expert={expert} />
      <Text style={s.listName}>
        {name}
        {disadvantage && <Text style={{ fontSize: 5, color: C.textMuted }}> (DIS)</Text>}
        {abilitySuffix && <Text style={{ color: C.textMuted }}>{` (${abilitySuffix})`}</Text>}
      </Text>
      <Text style={s.listVal}>{value}</Text>
    </View>
  )
}

function DeathSaves({ successes = 0, failures = 0 }) {
  return (
    <View style={[s.box, { marginBottom: 0 }]}>
      <Text style={s.boxLabel}>DEATH SAVES</Text>
      <View style={[s.row, { alignItems: 'center', marginBottom: 2 }]}>
        <Text style={[s.fieldLabel, { marginRight: 3, marginBottom: 0, width: 52 }]}>Successes</Text>
        {[0,1,2].map(i => <SmallCircle key={i} filled={i < successes} />)}
      </View>
      <View style={[s.row, { alignItems: 'center' }]}>
        <Text style={[s.fieldLabel, { marginRight: 3, marginBottom: 0, width: 52 }]}>Failures</Text>
        {[0,1,2].map(i => <SmallCircle key={i} filled={i < failures} />)}
      </View>
    </View>
  )
}

function ChargesDisplay({ current, max, recharge }) {
  const rec = recharge === 'short' ? 'Short Rest' : recharge === 'long' ? 'Long Rest' : recharge || null
  return (
    <Text style={[s.fieldLabel, { marginBottom: 2 }]}>
      Charges: {current ?? 0}/{max ?? 0}{rec ? `  (${rec})` : ''}
    </Text>
  )
}

// ── Page 1: core stats ────────────────────────────────────────────────────────

function CoreStatsPage({ d }) {
  const prof        = d.proficiency_bonus ?? 2
  const savingProfs = d.saving_throw_profs || []
  const skillProfs  = d.skill_profs || []
  const skillExp    = d.skill_expertise || []
  const conditions  = d.conditions || []
  const exhaustion  = d.exhaustion ?? 0
  const armorProfs  = d.armor_profs || []
  const hasNonProfArmor = (d.equipment || []).some(item =>
    item.type === 'armor' && item.equipped &&
    (armorProfs.includes(ARMOR_PROF_MAP[item.armor_category] || '') === false) &&
    item.armor_category != null
  )

  const abilityMod = a => mod(d[a] ?? 10)
  const skillBonus = sk => {
    const base = abilityMod(sk.ability)
    return base + (skillExp.includes(sk.name) ? prof * 2 : skillProfs.includes(sk.name) ? prof : 0)
  }
  const saveBonus = a => abilityMod(a) + (savingProfs.includes(a) ? prof : 0)

  const passivePerception = 10 + skillBonus(SKILLS.find(sk => sk.name === 'Perception'))
  const passiveInsight    = 10 + skillBonus(SKILLS.find(sk => sk.name === 'Insight'))

  const charStats = {
    strength: d.strength, dexterity: d.dexterity, constitution: d.constitution,
    intelligence: d.intelligence, wisdom: d.wisdom, charisma: d.charisma,
    proficiency_bonus: prof,
  }

  const classes  = d.classes || []
  const weapons  = (d.equipment || []).filter(e => e.type === 'weapon' && (e.attack_modifier || e.damage_roll))
  const classLine = classes.length > 0
    ? classes.map(classLabel).join(' / ')
    : [d.class, d.subclass].filter(Boolean).join(' — ') || '—'

  return (
    <Page size="LETTER" style={s.page}>
      {/* Header */}
      <View style={s.headerBox}>
        {d.portrait
          ? <Image style={s.portrait} src={d.portrait} />
          : <View style={s.portraitPh}><Text style={{ fontSize: 6, color: C.textMuted }}>No portrait</Text></View>
        }
        <View style={s.flex1}>
          <Text style={s.charName}>{d.name || 'Unnamed Character'}</Text>
          <Text style={s.headerMeta}>{classLine}</Text>
          <Text style={s.headerMeta}>{[d.race, d.background, d.alignment].filter(Boolean).join('  ·  ')}</Text>
          <Text style={s.headerMeta}>
            XP: {d.experience_points ?? 0}
            {d.size && d.size !== 'Medium' ? `  ·  Size: ${d.size}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <View style={[s.box, { alignItems: 'center', minWidth: 44, marginBottom: 0 }]}>
            <Text style={s.boxLabel}>PROF BONUS</Text>
            <Text style={s.boxValue}>{fmtMod(prof)}</Text>
          </View>
        </View>
      </View>

      {/* 3-column stats */}
      <View style={[s.row, { marginBottom: 5 }]}>

        {/* Col 1 — Ability scores */}
        <View style={{ width: 50, marginRight: 6 }}>
          <SectionHeader>Abilities</SectionHeader>
          {ABILITIES.map(a => (
            <View key={a} style={s.abilityBox}>
              <Text style={s.abilityLabel}>{ABILITY_SHORT[a]}</Text>
              <Text style={s.abilityScore}>{d[a] ?? 10}</Text>
              <Text style={s.abilityMod}>{fmtMod(abilityMod(a))}</Text>
            </View>
          ))}
          <View style={s.vspacer} />
          <View style={[s.box, { alignItems: 'center' }]}>
            <Text style={s.boxLabel}>INSPIRATION</Text>
            <Text style={s.boxValueSm}>{d.inspiration ? 'Yes' : '—'}</Text>
          </View>
        </View>

        {/* Col 2 — Saves + Skills */}
        <View style={{ width: 148, marginRight: 6 }}>
          <SectionHeader>Saving Throws</SectionHeader>
          {ABILITIES.map(a => (
            <ListRow key={a} proficient={savingProfs.includes(a)} name={ABILITY_SHORT[a]} value={fmtMod(saveBonus(a))}
              disadvantage={hasNonProfArmor && (a === 'strength' || a === 'dexterity')} />
          ))}
          <View style={s.vspacer} />
          <SectionHeader>Skills</SectionHeader>
          {SKILLS.map(sk => (
            <ListRow
              key={sk.name}
              proficient={skillProfs.includes(sk.name)}
              expert={skillExp.includes(sk.name)}
              name={sk.name}
              abilitySuffix={ABILITY_SHORT[sk.ability]}
              value={fmtMod(skillBonus(sk))}
              disadvantage={hasNonProfArmor && (sk.ability === 'strength' || sk.ability === 'dexterity')}
            />
          ))}
          <View style={s.vspacer} />
          <View style={s.row}>
            <View style={[s.box, s.flex1, { marginRight: 3 }]}>
              <Text style={s.boxLabel}>PASSIVE PERCEPTION</Text>
              <Text style={s.boxValueSm}>{passivePerception}</Text>
            </View>
            <View style={[s.box, s.flex1]}>
              <Text style={s.boxLabel}>PASSIVE INSIGHT</Text>
              <Text style={s.boxValueSm}>{passiveInsight}</Text>
            </View>
          </View>
        </View>

        {/* Col 3 — Combat */}
        <View style={s.flex1}>
          <SectionHeader>Combat</SectionHeader>
          <View style={[s.row, { marginBottom: 3 }]}>
            <StatBox label="ARMOR CLASS" value={d.armor_class ?? 10} />
            <StatBox label="INITIATIVE"  value={fmtMod(d.initiative_bonus ?? 0)} />
            <StatBox label="SPEED"       value={`${d.speed ?? 30} ft`} last />
          </View>
          <View style={[s.row, { marginBottom: 3 }]}>
            <StatBox label="MAX HP"     value={d.max_hp ?? 0} />
            <StatBox label="CURRENT HP" value={d.current_hp ?? 0} />
            <StatBox label="TEMP HP"    value={d.temp_hp ?? 0} last />
          </View>
          <View style={[s.row, { marginBottom: 3 }]}>
            <View style={[s.box, s.flex1, { marginRight: 3 }]}>
              <Text style={s.boxLabel}>HIT DICE</Text>
              <Text style={s.boxValueSm}>{d.hit_dice || '—'}</Text>
              <Text style={[s.fieldLabel, { marginTop: 1, marginBottom: 0 }]}>Remaining: {d.hit_dice_remaining || '—'}</Text>
            </View>
            <DeathSaves successes={d.death_save_successes} failures={d.death_save_failures} />
          </View>

          {/* Exhaustion — always shown */}
          <View style={[s.box, { marginBottom: 3 }]}>
            <Text style={s.boxLabel}>EXHAUSTION</Text>
            <View style={[s.row, { alignItems: 'center' }]}>
              {[1,2,3,4,5,6].map(lvl => (
                <SmallCircle key={lvl} filled={lvl <= exhaustion} />
              ))}
              {exhaustion > 0 && (
                <Text style={[s.fieldLabel, { marginLeft: 4, marginBottom: 0 }]}>Level {exhaustion}</Text>
              )}
            </View>
          </View>

          {/* Conditions — always shown */}
          <View style={[s.box, { marginBottom: 3 }]}>
            <Text style={s.boxLabel}>CONDITIONS</Text>
            <Text style={s.boxValueSm}>{conditions.length > 0 ? conditions.join(', ') : '—'}</Text>
          </View>
        </View>
      </View>

      {/* Attacks table */}
      {weapons.length > 0 && (
        <View style={{ marginBottom: 5 }}>
          <SectionHeader>Attacks</SectionHeader>
          <View style={s.tblHeader}>
            <Text style={[s.tblCellBold, { flex: 2 }]}>Name</Text>
            <Text style={[s.tblCellBold, { flex: 1 }]}>Atk Bonus</Text>
            <Text style={[s.tblCellBold, { flex: 1.5 }]}>Damage</Text>
            <Text style={[s.tblCellBold, { flex: 1 }]}>Type</Text>
            <Text style={[s.tblCellBold, { flex: 1 }]}>Range</Text>
            <Text style={[s.tblCellBold, { flex: 2 }]}>Properties</Text>
          </View>
          {weapons.map((w, i) => {
            const atkF = w.finesse_active && w.finesse_attack_modifier ? w.finesse_attack_modifier : w.attack_modifier
            const dmgF = w.finesse_active && w.finesse_damage_roll ? w.finesse_damage_roll : w.damage_roll
            const atkV = atkF ? fmtAtk(evalFormula(atkF, charStats)) : '—'
            const dmgV = dmgF ? evalFormula(dmgF, charStats) : '—'
            const propsStr = (w.properties || []).map(propLabel).join(', ')
            return (
              <View key={i} style={[s.tblRow, i % 2 === 1 ? { backgroundColor: C.bgAlt } : {}]}>
                <Text style={[s.tblCellBold, { flex: 2 }]}>{w.name || '—'}</Text>
                <Text style={[s.tblCell,     { flex: 1 }]}>{atkV}</Text>
                <Text style={[s.tblCell,     { flex: 1.5 }]}>{dmgV}</Text>
                <Text style={[s.tblCell,     { flex: 1 }]}>{w.weapon_specific || '—'}</Text>
                <Text style={[s.tblCell,     { flex: 1 }]}>{w.weapon_range || '—'}</Text>
                <Text style={[s.tblCell,     { flex: 2 }]}>{propsStr || '—'}</Text>
              </View>
            )
          })}
        </View>
      )}

      {(d.unarmed_attack_modifier || d.unarmed_damage_roll) && (
        <View>
          <SectionHeader>Unarmed Strike</SectionHeader>
          <View style={s.tblRow}>
            <Text style={[s.tblCellBold, { flex: 2 }]}>Unarmed Strike</Text>
            <Text style={[s.tblCell, { flex: 1 }]}>{d.unarmed_attack_modifier ? fmtAtk(evalFormula(d.unarmed_attack_modifier, charStats)) : '—'}</Text>
            <Text style={[s.tblCell, { flex: 1.5 }]}>{d.unarmed_damage_roll ? evalFormula(d.unarmed_damage_roll, charStats) : '—'}</Text>
            <Text style={[s.tblCell, { flex: 3.5 }]} />
          </View>
        </View>
      )}
    </Page>
  )
}

// ── Page 2: features (full width, no mid-description splits) ──────────────────

function FeaturesPage({ d }) {
  const featuresList = d.features_list || []
  const wpProfs   = d.weapon_profs || []
  const arProfs   = d.armor_profs  || []
  const toolProfs = d.tool_profs   || []
  const languages = d.languages    || []

  const hasFeatures    = featuresList.length > 0 || d.features_and_traits || d.additional_features_and_traits
  const hasPersonality = d.personality_traits || d.ideals || d.bonds || d.flaws
  const hasProfs       = wpProfs.length > 0 || arProfs.length > 0 || toolProfs.length > 0 || d.other_proficiencies
  const hasBackstory   = d.character_backstory || d.allies_and_organizations || d.treasure

  return (
    <Page size="LETTER" style={s.page}>

      {hasFeatures && (
        <>
          <SectionHeader>Features &amp; Traits</SectionHeader>
          {featuresList.map((f, i) => (
            <View key={i} wrap={false} style={s.itemBlock}>
              <View style={[s.row, { alignItems: 'baseline', flexWrap: 'wrap', gap: 4, marginBottom: 1 }]}>
                <Text style={s.featureName}>{f.name}</Text>
                {f.source ? <Text style={s.featureSource}>{f.source}</Text> : null}
              </View>
              {f.has_charges ? (
                <ChargesDisplay current={f.charges_current} max={f.charges_max} recharge={f.charges_recharge} />
              ) : null}
              {f.description ? <DirText style={s.textBlock}>{f.description}</DirText> : null}
            </View>
          ))}
          {d.features_and_traits ? (
            <View wrap={false} style={s.itemBlock}>
              <DirText style={s.textBlock}>{d.features_and_traits}</DirText>
            </View>
          ) : null}
        </>
      )}

      {d.additional_features_and_traits ? (
        <>
          <View style={s.vspacer} />
          <SectionHeader>Additional Features</SectionHeader>
          <View wrap={false} style={s.itemBlock}>
            <DirText style={s.textBlock}>{d.additional_features_and_traits}</DirText>
          </View>
        </>
      ) : null}

      {hasPersonality && (
        <>
          <View style={s.vspacer} />
          <SectionHeader>Personality</SectionHeader>
          {[
            { label: 'Personality Traits', value: d.personality_traits },
            { label: 'Ideals',             value: d.ideals             },
            { label: 'Bonds',              value: d.bonds              },
            { label: 'Flaws',              value: d.flaws              },
          ].filter(x => x.value).map(({ label, value }) => (
            <View key={label} wrap={false} style={s.itemBlock}>
              <Text style={s.featureName}>{label}</Text>
              <DirText style={s.textBlock}>{value}</DirText>
            </View>
          ))}
        </>
      )}

      {(hasProfs || languages.length > 0) && (
        <>
          <View style={s.vspacer} />
          <SectionHeader>Proficiencies &amp; Languages</SectionHeader>
          <View wrap={false} style={{ paddingVertical: 4 }}>
            {wpProfs.length > 0   && <Text style={[s.fieldLabel, { marginBottom: 2 }]}>Weapons: <Text style={{ fontFamily: 'NotoSans', color: C.text }}>{wpProfs.join(', ')}</Text></Text>}
            {arProfs.length > 0   && <Text style={[s.fieldLabel, { marginBottom: 2 }]}>Armor: <Text style={{ fontFamily: 'NotoSans', color: C.text }}>{arProfs.join(', ')}</Text></Text>}
            {toolProfs.length > 0 && <Text style={[s.fieldLabel, { marginBottom: 2 }]}>Tools: <Text style={{ fontFamily: 'NotoSans', color: C.text }}>{toolProfs.join(', ')}</Text></Text>}
            {languages.length > 0 && <Text style={[s.fieldLabel, { marginBottom: 2 }]}>Languages: <Text style={{ fontFamily: 'NotoSans', color: C.text }}>{languages.join(', ')}</Text></Text>}
            {d.other_proficiencies ? <DirText style={s.textBlock}>{d.other_proficiencies}</DirText> : null}
          </View>
        </>
      )}

      {hasBackstory && (
        <>
          <View style={s.vspacer} />
          <SectionHeader>Backstory</SectionHeader>
          {d.character_backstory ? (
            <View wrap={false} style={s.itemBlock}><DirText style={s.textBlock}>{d.character_backstory}</DirText></View>
          ) : null}
          {d.allies_and_organizations ? (
            <View wrap={false} style={s.itemBlock}>
              <Text style={s.featureName}>Allies &amp; Organizations</Text>
              <DirText style={s.textBlock}>{d.allies_and_organizations}</DirText>
            </View>
          ) : null}
          {d.treasure ? (
            <View wrap={false} style={s.itemBlock}>
              <Text style={s.featureName}>Treasure</Text>
              <DirText style={s.textBlock}>{d.treasure}</DirText>
            </View>
          ) : null}
        </>
      )}

      {(d.age || d.height || d.weight || d.eyes || d.skin || d.hair || d.appearance_notes) && (
        <>
          <View style={s.vspacer} />
          <SectionHeader>Appearance</SectionHeader>
          <View wrap={false} style={{ paddingVertical: 4 }}>
            <View style={[s.row, { flexWrap: 'wrap', gap: 6, marginBottom: 3 }]}>
              {[['Age', d.age], ['Height', d.height], ['Weight', d.weight], ['Eyes', d.eyes], ['Skin', d.skin], ['Hair', d.hair]]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <Text key={label} style={s.fieldLabel}>{label}: <Text style={{ fontFamily: 'NotoSans', color: C.text }}>{value}</Text></Text>
                ))
              }
            </View>
            {d.appearance_notes ? <DirText style={s.textBlock}>{d.appearance_notes}</DirText> : null}
          </View>
        </>
      )}

      {d.notes && (
        <>
          <View style={s.vspacer} />
          <SectionHeader>Notes</SectionHeader>
          <View wrap={false}><DirText style={s.textBlock}>{d.notes}</DirText></View>
        </>
      )}
    </Page>
  )
}

// ── Page 3: inventory ─────────────────────────────────────────────────────────

function InventoryPage({ d }) {
  const equipment = d.equipment || []
  const prof      = d.proficiency_bonus ?? 2
  const charStats = {
    strength: d.strength, dexterity: d.dexterity, constitution: d.constitution,
    intelligence: d.intelligence, wisdom: d.wisdom, charisma: d.charisma,
    proficiency_bonus: prof,
  }
  const wpProfs = (d.weapon_profs || []).map(p => p.toLowerCase())
  const arProfs = d.armor_profs || []

  function isWeaponProficient(item) {
    return wpProfs.includes((item.weapon_class || '').toLowerCase()) ||
           (item.weapon_specific && wpProfs.includes(item.weapon_specific.toLowerCase()))
  }
  function weaponStats(item) {
    return isWeaponProficient(item) ? charStats : { ...charStats, proficiency_bonus: 0 }
  }
  function isArmorProficient(item) {
    const tag = ARMOR_PROF_MAP[item.armor_category]
    return !tag || arProfs.includes(tag)
  }

  if (equipment.length === 0) return null

  return (
    <Page size="LETTER" style={s.page}>
      <SectionHeader>Inventory</SectionHeader>

      {/* Currency — all 5 always shown, full width */}
      <View style={s.coinRow}>
        {COIN.map((c, idx) => (
          <View key={c.key} style={[idx === COIN.length - 1 ? s.coinBoxLast : s.coinBox, { backgroundColor: c.bg }]}>
            <Text style={[s.coinValue, { color: c.text }]}>{d[c.key] ?? 0}</Text>
            <Text style={[s.coinLabel, { color: c.text }]}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Items by category */}
      {INVENTORY_CATEGORIES.map(cat => {
        const items = equipment.filter(e => (e.type || 'misc') === cat.type)
        if (items.length === 0) return null
        return (
          <View key={cat.type}>
            <CategoryHeader label={cat.label} headerBg={cat.headerBg} headerText={cat.headerText} />
            {items.map((item, i) => {
              const atkF = item.finesse_active && item.finesse_attack_modifier ? item.finesse_attack_modifier : item.attack_modifier
              const dmgF = item.finesse_active && item.finesse_damage_roll ? item.finesse_damage_roll : item.damage_roll
              const versP    = (item.properties || []).find(p => p.name === 'Versatile')
              const versDmg  = item.versatile_damage_roll || versP?.extra
              const effDmg   = item.versatile_active && versDmg ? versDmg : dmgF
              const atkV     = atkF ? fmtAtk(evalFormula(atkF, weaponStats(item))) : null
              const dmgV     = effDmg ? evalFormula(effDmg, charStats) : null
              const propsStr = (item.properties || []).map(propLabel).join(', ')
              const notProfWeapon = cat.type === 'weapon' && item.weapon_class && !isWeaponProficient(item)
              const notProfArmor  = cat.type === 'armor'  && item.armor_category && !isArmorProficient(item)

              return (
                <View key={i} wrap={false} style={s.itemBlock}>
                  {/* Name + badges */}
                  <View style={[s.row, { alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }]}>
                    <Text style={s.itemName}>
                      {item.amount && item.amount !== '1' ? `x${item.amount}  ` : ''}{item.name || '—'}
                    </Text>
                    {item.attuned && (
                      <View style={[s.badge, { backgroundColor: '#4c1d95', marginLeft: 5 }]}>
                        <Text style={[s.badgeText, { color: '#ede9fe' }]}>Attuned</Text>
                      </View>
                    )}
                    {(notProfWeapon || notProfArmor) && (
                      <View style={[s.badge, { backgroundColor: '#7f1d1d', marginLeft: 5 }]}>
                        <Text style={[s.badgeText, { color: '#fca5a5' }]}>Not Proficient</Text>
                      </View>
                    )}
                  </View>

                  {/* Weapon stats */}
                  {cat.type === 'weapon' && (item.weapon_class || atkV || dmgV) && (
                    <View style={[s.row, { flexWrap: 'wrap', alignItems: 'center', marginBottom: 3 }]}>
                      {item.weapon_class && (
                        <View style={[s.badge, { backgroundColor: '#3b1a1a', borderWidth: 1, borderStyle: 'solid', borderColor: '#7f1d1d' }]}>
                          <Text style={[s.badgeText, { color: '#fca5a5' }]}>
                            {item.weapon_class === 'simple' ? 'Simple' : 'Martial'} {item.weapon_range === 'ranged' ? 'Ranged' : 'Melee'}
                          </Text>
                        </View>
                      )}
                      {item.weapon_specific && (
                        <View style={[s.badge, { backgroundColor: C.subtle, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }]}>
                          <Text style={[s.badgeText, { color: C.text }]}>{item.weapon_specific}</Text>
                        </View>
                      )}
                      {atkV && <Text style={[s.tblCell, { marginRight: 8 }]}>Atk: <Text style={{ fontFamily: 'NotoSans', fontWeight: 'bold' }}>{atkV}</Text></Text>}
                      {dmgV && <Text style={[s.tblCell, { marginRight: 8 }]}>Dmg: <Text style={{ fontFamily: 'NotoSans', fontWeight: 'bold' }}>{dmgV}</Text></Text>}
                      {propsStr && <Text style={[s.tblCell, { color: C.textMuted }]}>{propsStr}</Text>}
                    </View>
                  )}

                  {/* Armor stats */}
                  {cat.type === 'armor' && (item.armor_category || item.ac_formula) && (
                    <View style={[s.row, { flexWrap: 'wrap', alignItems: 'center', marginBottom: 3 }]}>
                      {item.armor_category && (
                        <View style={[s.badge, { backgroundColor: '#1e3050', borderWidth: 1, borderStyle: 'solid', borderColor: '#1e3a5f' }]}>
                          <Text style={[s.badgeText, { color: '#93c5fd' }]}>
                            {item.armor_category.charAt(0).toUpperCase() + item.armor_category.slice(1)}
                            {item.equipped ? ' · Equipped' : ''}
                          </Text>
                        </View>
                      )}
                      {item.ac_formula && (() => {
                        const isShield = item.armor_category === 'shield'
                        const acVal = evalFormula(item.ac_formula, charStats)
                        const isComputational = isNaN(Number(item.ac_formula.trim()))
                        return (
                          <Text style={[s.tblCell, { marginLeft: 4 }]}>
                            {'AC: '}
                            <Text style={{ fontFamily: 'NotoSans', fontWeight: 'bold' }}>{(isShield ? '+' : '') + acVal}</Text>
                            {isComputational && <Text style={{ color: C.textMuted }}>{` (${item.ac_formula})`}</Text>}
                          </Text>
                        )
                      })()}
                    </View>
                  )}

                  {/* Charges */}
                  {item.has_charges && (
                    <ChargesDisplay current={item.charges_current} max={item.charges_max} recharge={item.charges_recharge} />
                  )}

                  {/* Price / Weight */}
                  {(item.price || item.weight) && (
                    <Text style={[s.fieldLabel, { marginBottom: 3 }]}>
                      {[item.price && `Price: ${item.price}`, item.weight && `Weight: ${item.weight}`].filter(Boolean).join('  ·  ')}
                    </Text>
                  )}

                  {/* Description */}
                  {item.description ? <DirText style={s.textBlock}>{item.description}</DirText> : null}
                </View>
              )
            })}
          </View>
        )
      })}
    </Page>
  )
}

// ── Page 4+: spellcasting — one page per caster class ─────────────────────────

function SpellcastingPage({ d, cls }) {
  const spells  = cls.spells || []
  const slots   = cls.spell_slots || {}
  const prof    = d.proficiency_bonus ?? 2

  const abilityIdx  = ABILITIES.indexOf(cls.casting_ability)
  const abilityMod  = abilityIdx >= 0 ? mod(d[ABILITIES[abilityIdx]] ?? 10) : 0
  const saveDC      = 8 + prof + abilityMod
  const attackBonus = prof + abilityMod

  const spellsByLevel = {}
  for (const sp of spells) {
    const lvl = sp.level ?? 0
    if (!spellsByLevel[lvl]) spellsByLevel[lvl] = []
    spellsByLevel[lvl].push(sp)
  }

  const className = [cls.name, cls.subclass].filter(Boolean).join(' — ')

  return (
    <Page size="LETTER" style={s.page}>
      <SectionHeader>{className} — Spellcasting</SectionHeader>

      {/* Spellcasting stats — full width, equal quarters */}
      <View style={[s.row, { marginBottom: 8 }]}>
        {[
          { label: 'ABILITY',       value: (cls.casting_ability || '—').toUpperCase() },
          { label: 'SPELL SAVE DC', value: String(saveDC) },
          { label: 'ATK BONUS',     value: fmtMod(attackBonus) },
          { label: 'SLOT RECOVERY', value: cls.slot_recovery === 'short' ? 'Short Rest' : 'Long Rest' },
        ].map((item, idx, arr) => (
          <View key={item.label} style={[s.box, { flex: 1, alignItems: 'center', marginRight: idx < arr.length - 1 ? 4 : 0, marginBottom: 0 }]}>
            <Text style={s.boxLabel}>{item.label}</Text>
            <Text style={[s.boxValue, { fontSize: 13 }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Spell slots */}
      {Object.keys(slots).length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={[s.fieldLabel, { marginBottom: 3 }]}>SPELL SLOTS</Text>
          <View style={[s.row, { flexWrap: 'wrap', gap: 4 }]}>
            {[1,2,3,4,5,6,7,8,9].map(lvl => {
              const slot = slots[lvl]
              if (!slot) return null
              return (
                <View key={lvl} style={[s.box, { alignItems: 'center', minWidth: 38, marginBottom: 0 }]}>
                  <Text style={s.boxLabel}>{SPELL_SLOT_LABELS[lvl]}</Text>
                  <Text style={s.boxValueSm}>{slot.left ?? 0}/{slot.max ?? 0}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Spells by level */}
      {Object.entries(spellsByLevel).sort(([a],[b]) => Number(a) - Number(b)).map(([lvl, lvlSpells]) => (
        <View key={lvl} style={{ marginBottom: 6 }}>
          <SectionHeader>
            {lvl === '0' ? 'Cantrips' : `${SPELL_SLOT_LABELS[Number(lvl)]} Level Spells`}
          </SectionHeader>
          <View style={s.tblHeader}>
            <Text style={[s.tblCellBold, { width: 20, textAlign: 'center' }]}>Prep</Text>
            <Text style={[s.tblCellBold, { flex: 2 }]}>Name</Text>
            <Text style={[s.tblCellBold, { flex: 1 }]}>School</Text>
            <Text style={[s.tblCellBold, { flex: 1 }]}>Cast Time</Text>
            <Text style={[s.tblCellBold, { flex: 1 }]}>Range</Text>
            <Text style={[s.tblCellBold, { flex: 1 }]}>Duration</Text>
            <Text style={[s.tblCellBold, { flex: 1 }]}>Components</Text>
          </View>
          {lvlSpells.map((sp, i) => {
            const rowBg = i % 2 === 1 ? C.bgAlt : C.bg
            return (
              <View key={i} wrap={false}>
                <View style={[s.tblRow, { backgroundColor: rowBg }]}>
                  <View style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>
                    <SmallCircle filled={!!sp.prepared} />
                  </View>
                  {/* Name + concentration badge */}
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={s.tblCellBold}>{sp.name}</Text>
                    {sp.concentration && (
                      <View style={{ marginLeft: 3, backgroundColor: '#4c1d95', borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 5, color: '#ede9fe', fontFamily: 'NotoSans', fontWeight: 'bold' }}>CONC</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.tblCell, { flex: 1 }]}>{sp.school    || '—'}</Text>
                  <Text style={[s.tblCell, { flex: 1 }]}>{sp.cast_time || '—'}</Text>
                  <Text style={[s.tblCell, { flex: 1 }]}>{sp.range     || '—'}</Text>
                  <Text style={[s.tblCell, { flex: 1 }]}>{sp.duration  || '—'}</Text>
                  <Text style={[s.tblCell, { flex: 1 }]}>{spellComponents(sp)}</Text>
                </View>
                {sp.description ? (
                  <View style={{ paddingLeft: 23, paddingRight: 4, paddingVertical: 2, backgroundColor: rowBg }}>
                    <DirText style={[s.textBlock, { fontSize: 7 }]}>{sp.description}</DirText>
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      ))}
    </Page>
  )
}

// ── Document ──────────────────────────────────────────────────────────────────

export default function CharacterPDF({ data }) {
  const equipment     = data.equipment || []
  const armorProfs    = data.armor_profs || []
  const hasNonProfArmor = equipment.some(item =>
    item.type === 'armor' && item.equipped && item.armor_category != null &&
    armorProfs.includes(ARMOR_PROF_MAP[item.armor_category] || '') === false
  )
  const casterClasses = (data.classes || []).filter(c => c.is_spellcaster)

  return (
    <Document title={data.name || 'Character Sheet'} author="Grimoire">
      <CoreStatsPage d={data} />
      <FeaturesPage  d={data} />
      {equipment.length > 0 && <InventoryPage d={data} />}
      {casterClasses.map((cls, i) => (
        <SpellcastingPage key={i} d={data} cls={cls} />
      ))}
    </Document>
  )
}
