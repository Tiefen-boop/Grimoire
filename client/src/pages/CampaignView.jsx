import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { PlusIcon, TrashIcon, UserPlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function CampaignView() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allPlayers, setAllPlayers] = useState([])
  const [myChars, setMyChars] = useState([])

  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedMember, setSelectedMember] = useState('')
  const [showAddChar, setShowAddChar] = useState(false)
  const [selectedChar, setSelectedChar] = useState('')
  const [assignTarget, setAssignTarget] = useState({})
  const [error, setError] = useState('')

  async function load() {
    const [camRes, charRes] = await Promise.all([
      api.get(`/campaigns/${id}`),
      api.get('/characters'),
    ])
    setCampaign(camRes.data)
    setMyChars(charRes.data)
  }

  useEffect(() => {
    load()
      .catch(() => navigate('/campaigns'))
      .finally(() => setLoading(false))

    api.get('/users/players').then(r => setAllPlayers(r.data)).catch(() => {})
  }, [id])

  async function addMember() {
    if (!selectedMember) return
    setError('')
    try {
      await api.post(`/campaigns/${id}/members`, { user_id: parseInt(selectedMember) })
      setSelectedMember('')
      setShowAddMember(false)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed')
    }
  }

  async function removeMember(userId) {
    await api.delete(`/campaigns/${id}/members/${userId}`)
    await load()
  }

  async function addCharacter() {
    if (!selectedChar) return
    setError('')
    try {
      await api.post(`/campaigns/${id}/characters`, { character_id: parseInt(selectedChar) })
      setSelectedChar('')
      setShowAddChar(false)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed')
    }
  }

  async function removeCharacter(charId) {
    await api.delete(`/campaigns/${id}/characters/${charId}`)
    await load()
  }

  async function copyCharacter(charId) {
    await api.post(`/campaigns/${id}/characters/${charId}/copy`)
    await load()
  }

  async function assignCharacter(charId, userId) {
    await api.put(`/campaigns/${id}/characters/${charId}/assign`, { user_id: userId ? parseInt(userId) : null })
    setAssignTarget(a => ({ ...a, [charId]: '' }))
    await load()
  }

  if (loading) return <div className="text-stone-400">Loading…</div>
  if (!campaign) return null

  const isDm = campaign.is_dm
  const memberIds = new Set(campaign.members.map(m => m.id))
  const charIdsInCampaign = new Set(campaign.characters.map(c => c.id))
  const addableChars = myChars.filter(c => !charIdsInCampaign.has(c.id))

  // Non-member players not yet in the campaign (and not the DM)
  const availablePlayers = allPlayers.filter(p => !memberIds.has(p.id) && p.id !== user.id)

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link to="/campaigns" className="text-stone-400 hover:text-stone-200 text-sm">← Campaigns</Link>
      </div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">{campaign.name}</h1>
          {campaign.description && <p className="text-stone-400 mt-1">{campaign.description}</p>}
          <div className="text-sm text-stone-500 mt-1">
            DM: <span className="text-stone-300">{campaign.dm_username}</span>
          </div>
        </div>
        {isDm && (
          <div className="flex gap-2">
            <button onClick={() => setShowAddMember(o => !o)} className="btn btn-secondary btn-sm">
              <UserPlusIcon className="w-4 h-4 mr-1" /> Add Player
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Add Member panel */}
      {isDm && showAddMember && (
        <div className="card mb-4 flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-40">
            <label className="label">Player</label>
            <select className="input" value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
              <option value="">Select player…</option>
              {availablePlayers.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
            </select>
          </div>
          <button onClick={addMember} className="btn btn-primary btn-sm">Add</button>
          <button onClick={() => setShowAddMember(false)} className="btn btn-secondary btn-sm">Cancel</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members list */}
        {isDm && (
          <div className="lg:col-span-1">
            <div className="card">
              <div className="section-title">Players</div>
              {campaign.members.length === 0 ? (
                <p className="text-stone-500 text-sm">No players yet.</p>
              ) : (
                <ul className="space-y-2">
                  {campaign.members.map(m => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span className="text-stone-300">{m.username}</span>
                      <button onClick={() => removeMember(m.id)} className="text-stone-500 hover:text-red-400 p-1">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Characters */}
        <div className={isDm ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-stone-200">Characters</h2>
            <button onClick={() => setShowAddChar(o => !o)} className="btn btn-secondary btn-sm">
              <PlusIcon className="w-4 h-4 mr-1" /> Add My Character
            </button>
          </div>

          {showAddChar && (
            <div className="card mb-4 flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-40">
                <label className="label">Character</label>
                <select className="input" value={selectedChar} onChange={e => setSelectedChar(e.target.value)}>
                  <option value="">Select character…</option>
                  {addableChars.map(c => <option key={c.id} value={c.id}>{c.name || 'Unnamed'} (Lv{c.level} {c.class})</option>)}
                </select>
              </div>
              <button onClick={addCharacter} className="btn btn-primary btn-sm">Add</button>
              <button onClick={() => setShowAddChar(false)} className="btn btn-secondary btn-sm">Cancel</button>
            </div>
          )}

          {campaign.characters.length === 0 ? (
            <div className="card text-stone-400 text-center py-8">No characters in this campaign yet.</div>
          ) : (
            <div className="space-y-3">
              {campaign.characters.map(c => (
                <CharacterCard
                  key={c.cc_id}
                  char={c}
                  isDm={isDm}
                  currentUserId={user.id}
                  campaignId={id}
                  campaignMembers={campaign.members}
                  assignValue={assignTarget[c.id] || ''}
                  onAssignChange={v => setAssignTarget(a => ({ ...a, [c.id]: v }))}
                  onAssign={() => assignCharacter(c.id, assignTarget[c.id])}
                  onCopy={() => copyCharacter(c.id)}
                  onRemove={() => removeCharacter(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CharacterCard({ char, isDm, currentUserId, campaignId, campaignMembers, assignValue, onAssignChange, onAssign, onCopy, onRemove }) {
  const navigate = useNavigate()
  const dmOwns = char.owner_id === currentUserId

  function openSheet(e) {
    navigate(`/characters/${char.id}`, { state: { campaignId } })
  }

  return (
    <div className="card hover:border-stone-500 transition-colors cursor-pointer" onClick={openSheet}>
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-stone-100">{char.name || 'Unnamed'}</span>
            {char.is_copy && (
              <span className="text-xs bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded">Copy</span>
            )}
            {isDm && char.owner_username && (
              <span className="text-xs text-stone-500">Owner: {char.owner_username}</span>
            )}
            {isDm && char.assigned_to_username && (
              <span className="text-xs text-blue-400">→ {char.assigned_to_username}</span>
            )}
          </div>
          <div className="text-stone-400 text-sm mt-0.5">
            {[char.race, char.class].filter(Boolean).join(' · ')}
            {char.level ? ` · Level ${char.level}` : ''}
          </div>
          <div className="text-sm text-stone-300 mt-1">
            HP: <span className="text-green-400">{char.current_hp}</span>/{char.max_hp}
          </div>
        </div>

        <div className="flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
          {isDm && dmOwns && (
            <>
              <div className="flex gap-1">
                <select
                  className="input text-sm py-1 w-36"
                  value={assignValue}
                  onChange={e => onAssignChange(e.target.value)}
                >
                  <option value="">Transfer to…</option>
                  {campaignMembers.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                </select>
                <button onClick={onAssign} className="btn btn-secondary btn-sm" title="Confirm">✓</button>
              </div>
            </>
          )}
          {isDm && !dmOwns && (
            <button onClick={onCopy} className="btn btn-secondary btn-sm" title="Copy character">
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={onRemove} className="btn btn-danger btn-sm" title="Remove from campaign">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
