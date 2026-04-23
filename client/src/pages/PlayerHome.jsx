import { useNavigate, useLocation } from 'react-router-dom'
import { useRef, useEffect } from 'react'
import Characters from './Characters'
import Campaigns from './Campaigns'

const TABS = ['characters', 'campaigns']
const TAB_LABELS = { characters: '🧙 Characters', campaigns: '⚔️ Campaigns' }

export default function PlayerHome() {
  const navigate = useNavigate()
  const location = useLocation()

  const activeTab = location.pathname.startsWith('/campaigns') ? 'campaigns' : 'characters'
  const slideDir = location.state?.slideDir || 'left'

  const activeTabRef = useRef(activeTab)
  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])

  useEffect(() => {
    let startX = null, startY = null

    function handleStart(e) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    function handleEnd(e) {
      if (startX === null) return
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      startX = null; startY = null
      if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return
      const idx = TABS.indexOf(activeTabRef.current)
      if (dx < 0 && idx < TABS.length - 1)
        navigate(`/${TABS[idx + 1]}`, { state: { slideDir: 'left' } })
      else if (dx > 0 && idx > 0)
        navigate(`/${TABS[idx - 1]}`, { state: { slideDir: 'right' } })
    }

    window.addEventListener('touchstart', handleStart, { passive: true })
    window.addEventListener('touchend', handleEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleStart)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [navigate])

  function goTo(t) {
    if (t === activeTab) return
    const dir = TABS.indexOf(t) > TABS.indexOf(activeTab) ? 'left' : 'right'
    navigate(`/${t}`, { state: { slideDir: dir } })
  }

  return (
    <div>
      <div className="flex border-b border-stone-700 mb-6">
        {TABS.map(t => (
          <button key={t} type="button" onClick={() => goTo(t)}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t ? 'border-red-600 text-stone-100' : 'border-transparent text-stone-500 hover:text-stone-300'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div key={location.key} className={`tab-wipe-${slideDir}`}>
        {activeTab === 'characters' ? <Characters /> : <Campaigns />}
      </div>
    </div>
  )
}
