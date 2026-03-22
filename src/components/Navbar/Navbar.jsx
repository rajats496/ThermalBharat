/**
 * Navbar.jsx — ThermalBharat Part 8A
 * ====================================
 * Professional 3-zone navbar:
 *   LEFT:   Logo + tagline
 *   CENTER: Nav links (Map / Compare / 2030 / Methodology / About)
 *   RIGHT:  City search + 30-cities badge + last-updated
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { INDIAN_STATES } from '../../utils/constants'

const NAV_LINKS = [
  { icon: '🗺️', label: 'Map',         labelHindi: 'नक्शा',        path: '/'            },
  { icon: '⚖️', label: 'Compare',     labelHindi: 'तुलना',        path: '/compare'     },
  { icon: '🔮', label: '2030',         labelHindi: '2030 पूर्वानुमान', path: '/predict'  },
  { icon: '📖', label: 'Methodology',  labelHindi: 'विधि',         path: '/methodology' },
  { icon: 'ℹ️', label: 'About',        labelHindi: 'बारे में',     path: '/about'       },
]

export default function Navbar({
  cities = [],
  selectedCityName,
  onCityChange,
  onOpenCompare,
  onOpenPredictions,
  onOpenMethodology,
  loadingProgressText,
  onAddCustomCity,
  showClusters,
  onToggleClusters,
  clusterReady,
}) {
  const navigate  = useNavigate()
  const location  = useLocation()

  const [menuOpen,     setMenuOpen]     = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [lastUpdated,  setLastUpdated]  = useState(0)       // minutes since load
  const [addCity,      setAddCity]      = useState(false)
  const [customCity,   setCustomCity]   = useState('')
  const [customState,  setCustomState]  = useState('')
  const [customErr,    setCustomErr]    = useState('')
  const [addingCity,   setAddingCity]   = useState(false)

  // Increment "last updated" counter every minute
  useEffect(() => {
    const interval = setInterval(() => setLastUpdated(m => m + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  // All cities sorted A-Z, filter by query when typed
  const filteredCities = [...cities]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(c =>
      !searchQuery.trim() ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nameHindi?.includes(searchQuery)
    )

  const handleCitySelect = (cityName) => {
    onCityChange(cityName)
    setSearchQuery('')
    setShowDropdown(false)
  }

  const handleNavClick = (link) => {
    setMenuOpen(false)
    navigate(link.path)
  }

  const submitCustomCity = async () => {
    const city = customCity.trim()
    if (!city) { setCustomErr('Enter a city name'); return }
    setAddingCity(true); setCustomErr('')
    try {
      await onAddCustomCity?.({ cityName: city, stateName: customState.trim() })
      setCustomCity(''); setCustomState(''); setAddCity(false)
    } catch (e) {
      setCustomErr(e?.message || 'City not found')
    } finally { setAddingCity(false) }
  }

  return (
    <header className="nb-root">

      {/* ── LEFT: Brand ─────────────────────────────── */}
      <div className="nb-brand">
        <span className="nb-logo">🌡️</span>
        <div>
          <div className="nb-title brand-gradient-text">ThermalBharat</div>
          <div className="nb-tagline" style={{ color: 'var(--text-300, #8895b0)' }}>Mapping India's Urban Heat, One City at a Time</div>
        </div>
      </div>

      {/* ── CENTER: Nav links ────────────────────────── */}
      <nav className="nb-links" aria-label="Main navigation">
        {NAV_LINKS.map(link => (
          <button
            key={link.path}
            className={`nb-link nb-nav-link ${location.pathname === link.path ? 'nb-link--active active' : ''}`}
            title={link.labelHindi}
            onClick={() => handleNavClick(link)}
            type="button"
          >
            <span className="nb-link-icon">{link.icon}</span>
            <span className="nb-link-label">{link.label}</span>
          </button>
        ))}
        {clusterReady && (
          <button
            type="button"
            className={`nb-link ${showClusters ? 'nb-link--active' : ''}`}
            title="हीट ज़ोन क्लस्टर"
            onClick={onToggleClusters}
          >
            <span className="nb-link-icon">🔵</span>
            <span className="nb-link-label">Zones</span>
          </button>
        )}
      </nav>

      {/* ── RIGHT: Search + meta ─────────────────────── */}
      <div className="nb-right">

        {/* City search box */}
        <div className="nb-search-wrap">
          <div className="nb-search-box">
            <span className="nb-search-icon">🔍</span>
            <input
              className="nb-search-input"
              type="text"
              placeholder="Search city..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              aria-label="Search city"
            />
          </div>

          {showDropdown && (
            <div className="nb-dropdown">
              {filteredCities.slice(0, 30).map(c => (
                <button
                  key={c.name}
                  type="button"
                  className="nb-dropdown-item"
                  onMouseDown={() => handleCitySelect(c.name)}
                >
                  <span>{c.name}</span>
                  <span className="hindi-text">{c.nameHindi}</span>
                </button>
              ))}
              {filteredCities.length === 0 && (
                <div className="nb-dropdown-empty">No city found</div>
              )}
              {searchQuery.trim() && (
                <button
                  type="button"
                  className="nb-dropdown-add"
                  onMouseDown={() => { setAddCity(true); setShowDropdown(false) }}
                >
                  ➕ Add "{searchQuery}" as custom city
                </button>
              )}
            </div>
          )}
        </div>

        {/* Badge + last-updated */}
        <div className="nb-badge">🛰️ 30 cities</div>
        <div className="nb-updated">
          {lastUpdated === 0
            ? 'Live data'
            : `Updated ${lastUpdated} min ago`}
        </div>

        {/* Loading progress */}
        {loadingProgressText && loadingProgressText !== 'All city weather loaded' && (
          <div className="nb-progress">{loadingProgressText}</div>
        )}
      </div>

      {/* ── Add custom city form (inline dropdown) ────── */}
      {addCity && (
        <div className="nb-add-city-panel">
          <input
            className="nb-add-input"
            placeholder="City name"
            value={customCity}
            onChange={e => setCustomCity(e.target.value)}
          />
          <select
            className="nb-add-select"
            value={customState}
            onChange={e => setCustomState(e.target.value)}
          >
            <option value="">State (optional)</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            type="button"
            className="nb-add-btn"
            onClick={submitCustomCity}
            disabled={addingCity}
          >
            {addingCity ? '…' : 'Add'}
          </button>
          <button
            type="button"
            className="nb-add-cancel"
            onClick={() => { setAddCity(false); setCustomErr('') }}
          >✕</button>
          {customErr && <span className="nb-add-err">{customErr}</span>}
        </div>
      )}

      {/* ── Mobile hamburger ─────────────────────────── */}
      <button
        type="button"
        className={`nb-hamburger ${menuOpen ? 'nb-hamburger--open' : ''}`}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
      >
        <span /><span /><span />
      </button>

      {/* ── Mobile overlay + drawer (framer-motion) ───── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="nb-mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.nav
              className="nb-mobile-drawer"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              onClick={e => e.stopPropagation()}
              aria-label="Mobile navigation"
            >
              <div className="nb-mobile-brand">
                🌡️ <strong>ThermalBharat</strong>
                <button
                  type="button"
                  className="nb-mobile-close"
                  onClick={() => setMenuOpen(false)}
                >✕</button>
              </div>
              {NAV_LINKS.map(link => (
                <button
                  key={link.path}
                  type="button"
                  className={`nb-mobile-link ${location.pathname === link.path ? 'nb-mobile-link--active' : ''}`}
                  onClick={() => handleNavClick(link)}
                >
                  <span style={{ fontSize: 22 }}>{link.icon}</span>
                  <span>
                    {link.label}
                    <span className="hindi-text" style={{ opacity: 0.55, fontSize: 13, marginLeft: 8 }}>— {link.labelHindi}</span>
                  </span>
                </button>
              ))}
              {/* City select in mobile */}
              <select
                className="nb-mobile-city-select"
                value={selectedCityName}
                onChange={e => { onCityChange(e.target.value); setMenuOpen(false) }}
              >
                <option value="">Select a city…</option>
                {[...cities].sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.nameHindi})</option>
                ))}
              </select>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
