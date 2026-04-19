import { useEffect, useState } from 'react'
import api from '../api/client'
import { PlusIcon, TrashIcon, KeyIcon, UserIcon } from '@heroicons/react/24/outline'

export default function Admin() {
  const [users, setUsers] = useState([])
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'player' })
  const [creating, setCreating] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).finally(() => setLoading(false))
    api.get('/characters/all').then(r => setCharacters(r.data)).catch(() => {})
  }, [])

  function notify(msg, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(''), 3000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  async function createUser(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await api.post('/users', form)
      setUsers(u => [...u, res.data])
      setShowNew(false)
      setForm({ username: '', password: '', role: 'player' })
      notify('User created')
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to create user', true)
    } finally {
      setCreating(false)
    }
  }

  async function deleteUser(id, username) {
    if (!confirm(`Delete user "${username}"? All their data will be lost.`)) return
    try {
      await api.delete(`/users/${id}`)
      setUsers(u => u.filter(x => x.id !== id))
      notify('User deleted')
    } catch (err) {
      notify(err.response?.data?.error || 'Failed', true)
    }
  }

  async function resetPassword(id) {
    if (!newPassword) return
    try {
      await api.put(`/users/${id}/password`, { password: newPassword })
      setResetTarget(null)
      setNewPassword('')
      notify('Password reset')
    } catch (err) {
      notify(err.response?.data?.error || 'Failed', true)
    }
  }

  if (loading) return <div className="text-stone-400">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-100">Admin Panel</h1>
        <button onClick={() => setShowNew(o => !o)} className="btn btn-primary">
          <PlusIcon className="w-4 h-4 mr-1" /> New User
        </button>
      </div>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-2 rounded-lg mb-4 text-sm">{success}</div>}

      {showNew && (
        <form onSubmit={createUser} className="card mb-6 space-y-3">
          <h2 className="font-bold text-stone-200">New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Username</label>
              <input className="input" value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="player">Player</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-700 text-stone-400">
              <th className="text-left px-4 py-3 font-medium">Username</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <>
                <tr key={u.id} className="border-b border-stone-800 hover:bg-stone-800/50">
                  <td className="px-4 py-3 text-stone-100 font-medium">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      u.role === 'admin' ? 'bg-red-900 text-red-300' : 'bg-stone-700 text-stone-300'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-400 hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => { setResetTarget(resetTarget === u.id ? null : u.id); setNewPassword('') }}
                        className="btn btn-secondary btn-sm" title="Reset password"
                      >
                        <KeyIcon className="w-4 h-4" />
                      </button>
                      {u.role !== 'admin' && (
                        <button onClick={() => deleteUser(u.id, u.username)} className="btn btn-danger btn-sm">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {resetTarget === u.id && (
                  <tr key={`reset-${u.id}`} className="bg-stone-800/50">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="text-stone-400 text-sm">New password for <strong className="text-stone-200">{u.username}</strong>:</span>
                        <input
                          type="password"
                          className="input w-48"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="New password"
                        />
                        <button onClick={() => resetPassword(u.id)} className="btn btn-primary btn-sm">Reset</button>
                        <button onClick={() => setResetTarget(null)} className="btn btn-secondary btn-sm">Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Characters overview */}
      <h2 className="text-xl font-bold text-stone-100 mt-8 mb-4 flex items-center gap-2">
        <UserIcon className="w-5 h-5 text-red-400" /> All Characters
      </h2>
      {characters.length === 0 ? (
        <div className="card text-stone-400 text-center py-8">No characters yet.</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-700 text-stone-400">
                <th className="text-left px-4 py-3 font-medium">Character</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Class</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Race</th>
                <th className="text-left px-4 py-3 font-medium">Level</th>
                <th className="text-left px-4 py-3 font-medium">Owner</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {characters.map(c => (
                <tr key={c.id} className="border-b border-stone-800 hover:bg-stone-800/50">
                  <td className="px-4 py-3 text-stone-100 font-medium">{c.name || <span className="text-stone-500">Unnamed</span>}</td>
                  <td className="px-4 py-3 text-stone-400 hidden sm:table-cell">{c.class || '—'}</td>
                  <td className="px-4 py-3 text-stone-400 hidden sm:table-cell">{c.race || '—'}</td>
                  <td className="px-4 py-3 text-stone-300">{c.level}</td>
                  <td className="px-4 py-3 text-stone-300">{c.owner_username}</td>
                  <td className="px-4 py-3 text-stone-500 hidden md:table-cell">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
