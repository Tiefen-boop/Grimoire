import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-red-900 text-red-100' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
    }`

  return (
    <nav className="bg-stone-900 border-b border-stone-700">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2 font-bold text-red-400 text-lg tracking-wide">
          📖 Grimoire
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {user?.role !== 'admin' && <NavLink to="/characters" className={linkClass}>Characters</NavLink>}
          <NavLink to="/campaigns" className={linkClass}>Campaigns</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin" className={linkClass}>Admin</NavLink>}
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <span className="text-stone-400 text-sm">{user?.username}</span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">Logout</button>
        </div>

        {/* Mobile hamburger */}
        <button className="sm:hidden p-2 rounded-lg text-stone-400 hover:bg-stone-800" onClick={() => setOpen(o => !o)}>
          {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden border-t border-stone-700 px-4 py-2 space-y-1">
          {user?.role !== 'admin' && <NavLink to="/characters" className={linkClass} onClick={() => setOpen(false)}>Characters</NavLink>}
          <NavLink to="/campaigns" className={linkClass} onClick={() => setOpen(false)}>Campaigns</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>Admin</NavLink>
          )}
          <div className="pt-2 border-t border-stone-700 flex items-center justify-between">
            <span className="text-stone-400 text-sm">{user?.username}</span>
            <button onClick={handleLogout} className="btn btn-secondary btn-sm">Logout</button>
          </div>
        </div>
      )}
    </nav>
  )
}
