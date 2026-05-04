import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useRef, useState } from 'react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import Modal from './Modal'
import api from '../api/client'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const [pwModal, setPwModal] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function openPwModal() {
    setPwModal(true)
    setPwForm({ current: '', next: '', confirm: '' })
    setPwError('')
    setPwSuccess(false)
    setUserMenuOpen(false)
    setOpen(false)
  }

  async function handleChangePassword() {
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match'); return }
    try {
      await api.put('/users/me/password', { current_password: pwForm.current, new_password: pwForm.next })
      setPwSuccess(true)
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password')
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-red-900 text-red-100' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
    }`

  return (
    <>
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
          {/* Username with dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button onClick={() => setUserMenuOpen(o => !o)}
              className="text-stone-400 text-sm hover:text-stone-200 transition-colors">
              {user?.username}
            </button>
            {userMenuOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 inline-flex bg-stone-800 border border-stone-600 rounded-lg shadow-xl z-50">
                <button onClick={openPwModal}
                  className="whitespace-nowrap px-4 py-2 text-sm text-stone-300 hover:bg-stone-700 hover:text-white rounded-lg transition-colors">
                  Change Password
                </button>
              </div>
            )}
          </div>
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
          <div className="pt-2 border-t border-stone-700 space-y-1">
            <div className="px-3 py-1 text-stone-400 text-sm">{user?.username}</div>
            <button onClick={openPwModal}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-stone-300 hover:bg-stone-800 hover:text-white transition-colors">
              Change Password
            </button>
            <button onClick={handleLogout} className="btn btn-secondary btn-sm w-full">Logout</button>
          </div>
        </div>
      )}
    </nav>

    {pwModal && (
      <Modal open title="Change Password"
        onConfirm={pwSuccess ? undefined : handleChangePassword}
        confirmLabel="Change Password"
        onCancel={() => setPwModal(false)}
        cancelLabel={pwSuccess ? 'Close' : 'Cancel'}>
        {pwSuccess ? (
          <p className="text-green-400 text-sm">Password changed successfully.</p>
        ) : (
          <div className="space-y-3">
            {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
            <div>
              <label className="label text-xs mb-1">Current Password</label>
              <input type="password" className="input w-full" value={pwForm.current}
                onChange={e => { setPwForm(f => ({ ...f, current: e.target.value })); setPwError('') }}
                autoFocus />
            </div>
            <div>
              <label className="label text-xs mb-1">New Password</label>
              <input type="password" className="input w-full" value={pwForm.next}
                onChange={e => { setPwForm(f => ({ ...f, next: e.target.value })); setPwError('') }} />
            </div>
            <div>
              <label className="label text-xs mb-1">Confirm New Password</label>
              <input type="password" className="input w-full" value={pwForm.confirm}
                onChange={e => { setPwForm(f => ({ ...f, confirm: e.target.value })); setPwError('') }}
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()} />
            </div>
          </div>
        )}
      </Modal>
    )}
    </>
  )
}
