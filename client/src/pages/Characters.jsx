import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { PlusIcon, TrashIcon, UserCircleIcon } from '@heroicons/react/24/outline'

export default function Characters() {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/characters').then(r => setCharacters(r.data)).finally(() => setLoading(false))
  }, [])

  async function deleteChar(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await api.delete(`/characters/${id}`)
    setCharacters(c => c.filter(x => x.id !== id))
  }

  if (loading) return <div className="text-stone-400">Loading characters…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-100">My Characters</h1>
        <Link to="/characters/new" className="btn btn-primary">
          <PlusIcon className="w-4 h-4 mr-1" /> New Character
        </Link>
      </div>

      {characters.length === 0 ? (
        <div className="card text-center text-stone-400 py-12">
          <div className="text-4xl mb-3">🎲</div>
          <p>No characters yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map(c => (
            <div key={c.id} className="card hover:border-stone-500 transition-colors relative group">
              <Link to={`/characters/${c.id}`} className="block">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-800 border border-stone-700 shrink-0 flex items-center justify-center">
                    {c.portrait
                      ? <img src={c.portrait} className="w-full h-full object-cover" alt="portrait" />
                      : <UserCircleIcon className="w-7 h-7 text-stone-600" />}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="font-bold text-lg text-stone-100 truncate">{c.name || 'Unnamed'}</div>
                    <div className="text-stone-400 text-sm">
                      {[c.race, c.class].filter(Boolean).join(' · ')}
                      {c.level ? ` · Level ${c.level}` : ''}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-sm text-stone-300">
                  <span>HP: <span className="text-green-400">{c.current_hp}</span>/{c.max_hp}</span>
                </div>
              </Link>
              <button
                onClick={() => deleteChar(c.id, c.name)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
