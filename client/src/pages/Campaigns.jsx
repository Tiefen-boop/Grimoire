import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { PlusIcon, TrashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/campaigns').then(r => setCampaigns(r.data)).finally(() => setLoading(false))
  }, [])

  async function createCampaign(e) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      const res = await api.post('/campaigns', form)
      setCampaigns(c => [...c, { ...res.data, is_dm: 1 }])
      setShowNew(false)
      setForm({ name: '', description: '' })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  async function deleteCampaign(id, name) {
    if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return
    await api.delete(`/campaigns/${id}`)
    setCampaigns(c => c.filter(x => x.id !== id))
  }

  if (loading) return <div className="text-stone-400">Loading campaigns…</div>

  const dmCampaigns = campaigns.filter(c => c.is_dm)
  const memberCampaigns = campaigns.filter(c => !c.is_dm)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-100">Campaigns</h1>
        <button onClick={() => setShowNew(o => !o)} className="btn btn-primary">
          <PlusIcon className="w-4 h-4 mr-1" /> New Campaign
        </button>
      </div>

      {showNew && (
        <form onSubmit={createCampaign} className="card mb-6 space-y-3">
          <h2 className="font-bold text-stone-200">New Campaign</h2>
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {dmCampaigns.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-300 mb-3 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-red-400" /> As Dungeon Master
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dmCampaigns.map(c => (
              <CampaignCard key={c.id} campaign={c} onDelete={deleteCampaign} />
            ))}
          </div>
        </div>
      )}

      {memberCampaigns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-300 mb-3">As Player</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {memberCampaigns.map(c => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        </div>
      )}

      {campaigns.length === 0 && (
        <div className="card text-center text-stone-400 py-12">
          <div className="text-4xl mb-3">⚔️</div>
          <p>No campaigns yet. Create one or wait to be invited!</p>
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign, onDelete }) {
  return (
    <div className="card hover:border-stone-500 transition-colors relative group">
      <Link to={`/campaigns/${campaign.id}`} className="block">
        <div className="font-bold text-stone-100 pr-8">{campaign.name}</div>
        {campaign.description && (
          <p className="text-stone-400 text-sm mt-1 line-clamp-2">{campaign.description}</p>
        )}
        <div className="text-xs text-stone-500 mt-2">
          DM: {campaign.dm_username}
        </div>
      </Link>
      {onDelete && (
        <button
          onClick={() => onDelete(campaign.id, campaign.name)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
