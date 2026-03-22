/**
 * PredictionsPage.jsx — Part 8C, Page 2
 * =======================================
 * Full-page 2030 temperature predictions at /predict
 */

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { indianCities } from '../../data/indianCities'
import { fetchERA5Slope, buildCombinedChartData } from '../../utils/mlModels'
import { getRiskBand } from '../../utils/calculations'

// ── helpers ───────────────────────────────────────────────────────
function getRiskEmoji(increase) {
  if (increase == null) return '⬜'
  if (increase < 1)  return '🟢'
  if (increase < 2)  return '🟡'
  if (increase < 3)  return '🟠'
  return '🔴'
}
function getIncreaseColor(increase) {
  if (increase == null) return '#888'
  if (increase < 1)  return '#00cc88'
  if (increase < 2)  return '#ffcc00'
  if (increase < 3)  return '#ff8800'
  return '#ff4444'
}

// Rough region assignment by state
function getRegion(city) {
  const north = ['Delhi', 'Lucknow', 'Jaipur', 'Agra', 'Patna', 'Chandigarh', 'Amritsar', 'Kanpur']
  const south = ['Chennai', 'Bangalore', 'Hyderabad', 'Kochi', 'Coimbatore', 'Visakhapatnam']
  const west  = ['Mumbai', 'Pune', 'Ahmedabad', 'Surat', 'Bhopal', 'Indore', 'Nagpur']
  const east  = ['Kolkata', 'Bhubaneswar', 'Ranchi', 'Guwahati']
  if (north.includes(city)) return { label: 'North', emoji: '🏔️' }
  if (south.includes(city)) return { label: 'South', emoji: '🌴' }
  if (west.includes(city))  return { label: 'West',  emoji: '🌊' }
  if (east.includes(city))  return { label: 'East',  emoji: '🌿' }
  return { label: 'Central', emoji: '☀️' }
}

// ── City prediction card ──────────────────────────────────────────
function PredCard({ row, rank }) {
  const region = getRegion(row.name)
  const color  = getIncreaseColor(row.increase)
  return (
    <motion.div
      className="pp-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03, duration: 0.35 }}
    >
      {/* Rank badge */}
      <div className="pp-rank" style={{ color: rank < 5 ? '#ff4444' : '#888' }}>#{rank + 1}</div>

      {/* Region emoji */}
      <div className="pp-region-emoji">{region.emoji}</div>

      {/* City name */}
      <div className="pp-city-name">{row.name}</div>
      <div className="pp-city-hindi">{row.nameHindi}</div>
      <div className="pp-region-label">{region.label} India</div>

      {/* Temperature arrow */}
      <div className="pp-temp-row">
        <span className="pp-temp-current">{row.current != null ? `${row.current.toFixed(1)}°C` : '—'}</span>
        <span className="pp-arrow" style={{ color }}>→</span>
        <span className="pp-temp-2030" style={{ color: '#ff4444' }}>
          {row.pred2030 != null ? `${row.pred2030.toFixed(1)}°C` : '—'}
        </span>
      </div>

      {/* Warming badge */}
      <div className="pp-warming-badge" style={{ background: `${color}22`, border: `1px solid ${color}44`, color }}>
        {getRiskEmoji(row.increase)}&nbsp;
        {row.increase != null ? `+${row.increase}°C` : '—'} by 2030
      </div>

      {/* Rate */}
      {row.rate != null && (
        <div className="pp-rate">
          {row.rate > 0 ? '+' : ''}{row.rate}°C / decade
        </div>
      )}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function PredictionsPage({ cityWeatherData }) {
  const navigate  = useNavigate()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [filter, setFilter]   = useState('warming') // 'all' | 'warming' | 'least' | 'north' | 'south' | 'west' | 'east'

  const total = indianCities.length

  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      setLoading(true); setProgress(0)
      const results = []
      for (let i = 0; i < indianCities.length; i++) {
        if (cancelled) return
        const city = indianCities[i]
        try {
          const era5 = await fetchERA5Slope(city.latitude, city.longitude)
          const { base, pred2030, totalIncrease, combinedSlope } = buildCombinedChartData({
            cityName: city.name, suhiSlope: null, omSlope: era5.slope, hasSuhi: false,
          })
          const rate = combinedSlope != null ? parseFloat((combinedSlope * 10).toFixed(2)) : null
          results.push({ name: city.name, nameHindi: city.nameHindi, current: base, pred2030, increase: totalIncrease, rate })
        } catch {
          results.push({ name: city.name, nameHindi: city.nameHindi, current: null })
        }
        setProgress(i + 1)
      }
      if (!cancelled) {
        results.sort((a, b) => (b.increase ?? -999) - (a.increase ?? -999))
        setRows(results)
        setLoading(false)
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'least')  return [...rows].sort((a, b) => (a.increase ?? 999) - (b.increase ?? 999))
    if (filter === 'north')  return rows.filter(r => getRegion(r.name).label === 'North')
    if (filter === 'south')  return rows.filter(r => getRegion(r.name).label === 'South')
    if (filter === 'west')   return rows.filter(r => getRegion(r.name).label === 'West')
    if (filter === 'east')   return rows.filter(r => getRegion(r.name).label === 'East')
    return rows  // 'warming' or 'all' — already sorted by highest increase
  }, [rows, filter])

  const FILTERS = [
    { id: 'warming', label: '🔥 Most Warming' },
    { id: 'least',   label: '❄️ Least Warming' },
    { id: 'all',     label: '🌐 All Cities' },
    { id: 'north',   label: '🏔️ North' },
    { id: 'south',   label: '🌴 South' },
    { id: 'west',    label: '🌊 West' },
    { id: 'east',    label: '🌿 East' },
  ]

  const maxIncrease = rows[0]?.increase ?? 3
  const avgIncrease = rows.length
    ? (rows.reduce((s, r) => s + (r.increase ?? 0), 0) / rows.length).toFixed(2)
    : 0

  return (
    <motion.div
      className="pp-root"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
    >
      {/* Back */}
      <button className="cdp-back-btn" onClick={() => navigate(-1)}>← Back</button>

      {/* Hero banner */}
      <div className="pp-hero">
        <h1 className="pp-hero-title">🔮 India's Temperature Future</h1>
        <p className="pp-hero-hindi hindi-text">भारत का तापमान भविष्य</p>
        <p className="pp-hero-sub">
          Based on 22 years of satellite + measured data · ML Linear Regression
        </p>
        {!loading && (
          <div className="pp-hero-stats">
            <div className="pp-hero-stat">
              <span>{maxIncrease?.toFixed ? maxIncrease.toFixed(2) : maxIncrease}°C</span>
              <small>Max warming</small>
            </div>
            <div className="pp-hero-stat">
              <span>{avgIncrease}°C</span>
              <small>Avg warming</small>
            </div>
            <div className="pp-hero-stat">
              <span>{rows.filter(r => (r.increase ?? 0) >= 2).length}</span>
              <small>Cities &gt; +2°C</small>
            </div>
            <div className="pp-hero-stat">
              <span>2030</span>
              <small>Forecast year</small>
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="pp-loading">
          <div className="spinner" />
          <div>Running ML predictions… ML भविष्यवाणी चल रही है…</div>
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 6 }}>{progress} / {total} cities</div>
          <div className="pred-progress-bar" style={{ maxWidth: 320, margin: '12px auto 0' }}>
            <div className="pred-progress-fill" style={{ width: `${(progress / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Filter bar */}
      {!loading && (
        <>
          <div className="pp-filter-bar">
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`pp-filter-btn ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Cards grid */}
          <div className="pp-grid">
            <AnimatePresence mode="popLayout">
              {filtered.map((row, i) => (
                <PredCard key={row.name} row={row} rank={i} />
              ))}
            </AnimatePresence>
          </div>

          <p className="pp-disclaimer">
            ⚠️ Predictions based on recent ERA5 trends. Actual warming depends on emissions, policy, and land use changes.
          </p>
        </>
      )}
    </motion.div>
  )
}
