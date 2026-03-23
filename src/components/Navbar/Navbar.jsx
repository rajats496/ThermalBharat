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

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

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
    <>
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

      {/* ── Mobile hamburger (inline styles = always visible) ── */}
      <button
        type="button"
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
        style={{
          display: 'none', // shown via CSS on mobile
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '5px',
          padding: '8px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          zIndex: 2000,
          position: 'relative',
          minHeight: 44,
          minWidth: 44,
        }}
        className="nb-hamburger-btn"
      >
        <span style={{
          display: 'block', width: 22, height: 2,
          background: 'white', borderRadius: 2,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none',
        }} />
        <span style={{
          display: 'block', width: 22, height: 2,
          background: 'white', borderRadius: 2,
          transition: 'opacity 0.3s ease',
          opacity: menuOpen ? 0 : 1,
        }} />
        <span style={{
          display: 'block', width: 22, height: 2,
          background: 'white', borderRadius: 2,
          transition: 'transform 0.3s ease',
          transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none',
        }} />
      </button>

      {/* ── Mobile search (right of hamburger, mobile only, home page only) ── */}
      {location.pathname === '/' && <div className="nb-mobile-search">
        <form className="nb-mobile-search-box" action="" onSubmit={async e => {
          e.preventDefault()
          const q = searchQuery.trim()
          if (!q) return
          const match = filteredCities[0]
          setSearchQuery('')
          setShowDropdown(false)
          if (match) {
            // Known city — just navigate
            onCityChange(match.name)
          } else {
            // Unknown city — addCustomCity fetches data AND navigates
            try {
              await onAddCustomCity?.({ cityName: q, stateName: '' })
            } catch { /* city not found — stays on home */ }
          }
        }}>
          <span className="nb-search-icon">🔍</span>
          <input
            className="nb-mobile-search-input"
            type="search"
            enterKeyHint="go"
            placeholder="Search city..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 400)}
            aria-label="Search city"
          />
          <button type="submit" className="nb-mobile-search-go" aria-label="Go">➜</button>
        </form>
        {showDropdown && searchQuery.trim() && (
          <div className="nb-mobile-dropdown">
            {filteredCities.slice(0, 10).map(c => (
              <button
                key={c.name}
                type="button"
                className="nb-dropdown-item"
                onTouchEnd={(e) => { 
                  e.preventDefault()
                  setSearchQuery('')
                  setShowDropdown(false)
                  onCityChange(c.name)
                }}
                onMouseDown={() => { 
                  setSearchQuery('')
                  setShowDropdown(false)
                  onCityChange(c.name)
                }}
              >
                <span>{c.name}</span>
                <span className="hindi-text" style={{ fontSize: 11, opacity: 0.7 }}>{c.nameHindi}</span>
              </button>
            ))}
            {filteredCities.length === 0 && (
              <div className="nb-dropdown-empty">No city found</div>
            )}
          </div>
        )}
      </div>}
    </header>

    {/* ── Mobile overlay — OUTSIDE header so it's not clipped ── */}
    <AnimatePresence>
        {menuOpen && (
          <>
            {/* Dark backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.75)',
                zIndex: 1998,
              }}
            />
            {/* Menu panel slides down */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                background: '#0d1117',
                zIndex: 1999,
                padding: '70px 24px 28px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
              }}
            >
              {/* Brand row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>🌡️ ThermalBharat</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', width: 34, height: 34, borderRadius: '50%',
                    cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              </div>

              {/* Nav links */}
              {NAV_LINKS.map(link => {
                const isActive = location.pathname === link.path
                return (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => handleNavClick(link)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      width: '100%', background: 'none', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      color: isActive ? '#ff4444' : '#c8d3e8',
                      fontSize: 18, fontWeight: isActive ? 700 : 500,
                      padding: '16px 0', cursor: 'pointer', textAlign: 'left',
                      minHeight: 56,
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{link.icon}</span>
                    <span>{link.label}</span>
                    {isActive && <span style={{ marginLeft: 'auto', color: '#ff4444', fontSize: 14 }}>●</span>}
                  </button>
                )
              })}

              {/* City selector */}
              <select
                style={{
                  marginTop: 20, width: '100%',
                  background: '#131929', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f0f4ff', borderRadius: 12,
                  padding: '13px 16px', fontSize: 16, cursor: 'pointer',
                }}
                value={selectedCityName}
                onChange={e => { onCityChange(e.target.value); setMenuOpen(false) }}
              >
                <option value="">Select a city…</option>
                {[...cities].sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.nameHindi})</option>
                ))}
              </select>
            </motion.div>
          </>
        )}
    </AnimatePresence>
    </>
  )
}
