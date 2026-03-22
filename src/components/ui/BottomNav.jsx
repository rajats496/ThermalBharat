/**
 * BottomNav.jsx — Fixed bottom navigation for mobile (< 768px)
 */
import { useLocation, useNavigate } from 'react-router-dom'

const ITEMS = [
  { icon: '🗺️', label: 'Map',     to: '/' },
  { icon: '⚖️', label: 'Compare', to: '/compare' },
  { icon: '🔮', label: '2030',    to: '/predict' },
  { icon: '📖', label: 'Guide',   to: '/methodology' },
  { icon: 'ℹ️', label: 'About',   to: '/about' },
]

export default function BottomNav() {
  const navigate  = useNavigate()
  const location  = useLocation()

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {ITEMS.map(item => {
        const active = item.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.to)
        return (
          <button
            key={item.to}
            className={`bottom-nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.to)}
            type="button"
            aria-label={item.label}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
