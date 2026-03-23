/**
 * CityDetailPage.jsx — ThermalBharat Part 8B
 * =============================================
 * Full-page city detail view at /city/:cityName
 * Reuses ALL existing logic from CityDetailPanel.
 * Only layout and animations are new.
 *
 * Layout (desktop):
 *   HERO HEADER   — gradient bg, huge temp, risk badge
 *   3 COLUMNS     — conditions | mini-map | forecast
 *   CHARTS ROW    — trend chart + SUHI chart
 *   ANALYSIS ROW  — tree calculator + heat inequality
 *   ADVANCED ROW  — heat calendar + share card
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams }       from 'react-router-dom'
import { motion }                       from 'framer-motion'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import {
  findConsecutiveHeatwaveDays,
  getHeatLevel,
  getHindiDayName,
  getRiskBand,
  getRiskLabel,
} from '../../utils/calculations'

import { SplitTrendCharts }   from './CityDetailPanel'
import TreePlantingCalculator from './TreePlantingCalculator'
import HeatInequalityPanel    from './HeatInequalityPanel'
import HeatCalendar           from './HeatCalendar'
import ShareCard              from './ShareCard'
import HeatOverlay            from '../Map/HeatOverlay'
import NDVIOverlay, { NDVILegend } from '../Map/NDVIOverlay'

// ── helpers ────────────────────────────────────────────────────
function toCompass(deg = 0) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}

/** Returns a dark gradient string based on temperature */
function tempGradient(temp) {
  if (!temp || temp < 30) return 'linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)'
  if (temp < 36) return 'linear-gradient(135deg, #0a2010 0%, #1a3d20 100%)'
  if (temp < 40) return 'linear-gradient(135deg, #201800 0%, #3d2e00 100%)'
  if (temp < 44) return 'linear-gradient(135deg, #2a0800 0%, #5a1500 100%)'
  return 'linear-gradient(135deg, #3a0000 0%, #7a0000 100%)'
}

// ── Count-up animation hook ────────────────────────────────────
function useCountUp(target, duration = 1000) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target == null) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const prog = Math.min((ts - start) / duration, 1)
      setCount(Math.round(prog * target))
      if (prog < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return count
}

// ── Card animation variants ─────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  show:   { opacity: 1, scale: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08 } },
}

// ── Mini city map with overlays ────────────────────────────────
const OVERLAY_MODES = [
  { id: 'none',     label: '🗺️ Map' },
  { id: 'heat',     label: '🌡️ Heat' },
  { id: 'trees',    label: '🌿 Trees' },
  { id: 'combined', label: '⚠️ Combined' },
]

function CityMiniMap({ city }) {
  const [overlayMode, setOverlayMode] = useState('none')
  if (!city) return null

  const showHeat    = overlayMode === 'heat'
  const showNDVI    = overlayMode === 'trees' || overlayMode === 'combined'

  return (
    <div style={{ position: 'relative' }}>
      {/* Overlay mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {OVERLAY_MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => setOverlayMode(m.id)}
            style={{
              padding: '5px 10px', fontSize: 11, borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${overlayMode === m.id ? '#ff4444' : 'rgba(255,255,255,0.15)'}`,
              background: overlayMode === m.id ? 'rgba(255,68,68,0.15)' : 'rgba(255,255,255,0.05)',
              color: overlayMode === m.id ? '#ff6666' : '#aaa',
              transition: 'all 0.18s',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <MapContainer
        center={[city.latitude, city.longitude]}
        zoom={11}
        zoomControl={true}
        scrollWheelZoom={true}
        dragging={true}
        className="cdp-mini-map"
        style={{ height: 300, borderRadius: 12, overflow: 'hidden' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CartoDB"
        />

        {/* City center marker — always visible on top of any overlay */}
        <CircleMarker
          center={[city.latitude, city.longitude]}
          radius={10}
          fillColor="#ff4444"
          color="#ffffff"
          weight={2.5}
          fillOpacity={0.9}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
            <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
              <strong style={{ fontSize: 13 }}>{city.name}</strong><br />
              <span style={{ fontSize: 11, color: '#aaa' }}>{city.nameHindi}</span><br />
              <span style={{ fontSize: 10, color: '#888' }}>
                {city.latitude.toFixed(4)}°N, {city.longitude.toFixed(4)}°E
              </span>
            </div>
          </Tooltip>
        </CircleMarker>

        {/* Heat overlay */}
        {showHeat && (
          <HeatOverlay
            city={city}
            visible={true}
            onHide={() => setOverlayMode('none')}
          />
        )}

        {/* NDVI / Combined overlay */}
        {showNDVI && (
          <NDVIOverlay
            city={city}
            mode={overlayMode}
          />
        )}
      </MapContainer>

      {/* Legend */}
      {showNDVI && (
        <div style={{ marginTop: 6 }}>
          <NDVILegend mode={overlayMode} />
        </div>
      )}
      {showHeat && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
          🛰️ Yale YCEO Satellite SUHI data · blue = cool, red = hot island
        </div>
      )}
    </div>
  )
}

// ── Forecast scroll cards ───────────────────────────────────────
function ForecastCards({ forecast }) {
  if (!forecast?.length) return <p style={{ color: '#888', fontSize: 13 }}>No forecast data</p>
  return (
    <div className="cdp-forecast-scroll">
      {forecast.map((day, i) => {
        const level = getHeatLevel(day.max_temp)
        return (
          <motion.div
            key={day.date}
            className="cdp-forecast-card"
            variants={cardVariants}
            style={{ borderColor: level.color }}
          >
            <strong style={{ color: level.color }}>{day.day_name}</strong>
            <small className="hindi-text">{getHindiDayName(day.day_name)}</small>
            <img
              src={`https://openweathermap.org/img/wn/${day.icon || '01d'}@2x.png`}
              alt={day.description}
              style={{ width: 44, height: 44 }}
            />
            <span style={{ color: '#eee', fontSize: 13, fontWeight: 600 }}>
              {day.min_temp}° / {day.max_temp}°
            </span>
            <small style={{ color: '#888', textAlign: 'center' }}>{day.description}</small>
          </motion.div>
        )
      })}
    </div>
  )
}

// ── Safe hours timeline ─────────────────────────────────────────
function SafeHoursBar({ hourly }) {
  if (!hourly?.length) return null
  return (
    <div className="cdp-safe-hours">
      {hourly.map((slot, i) => {
        let bg = '#00cc88'
        if (slot.risk_level > 7) bg = '#ff4444'
        else if (slot.risk_level > 5) bg = '#ff8800'
        else if (slot.risk_level > 3) bg = '#ffcc00'
        return (
          <div
            key={`${slot.hour}-${i}`}
            className="cdp-hour-slot"
            style={{ background: bg }}
            title={`${slot.hour} — Risk ${slot.risk_level}/10`}
          >
            <small>{slot.hour}</small>
          </div>
        )
      })}
    </div>
  )
}

// ── NeighborhoodGrid (temperature variation by direction) ────────
function NeighborhoodGrid({ neighborhood, cityHasGEEData }) {
  if (!neighborhood?.length) return null
  return (
    <motion.div className="cdp-glass-card" variants={cardVariants}>
      <h3 className="cdp-card-title">
        {cityHasGEEData
          ? '🏘️ Neighborhood Temperature Variation'
          : '🏘️ Approximate Neighborhood Differences'}
      </h3>
      <div className="neighborhood-grid">
        {neighborhood.map(entry => (
          <div key={entry.direction} className="neighborhood-cell" style={{ borderColor: entry.color }}>
            <strong>{entry.direction}</strong>
            <span>{entry.temperature}°C</span>
          </div>
        ))}
      </div>
      {!cityHasGEEData && (
        <p className="hindi-text" style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
          Approximate data · अनुमानित पड़ोस डेटा
        </p>
      )}
    </motion.div>
  )
}

// ── Main page component ─────────────────────────────────────────
export default function CityDetailPage({ cities, cityDetailsData, cityWeatherData, nearestCenterByCity, onShowHeatOverlay }) {
  const { cityName }  = useParams()
  const navigate      = useNavigate()

  const city   = cities?.find(c => c.name === cityName) || null
  const detailData = cityDetailsData?.[cityName] || cityWeatherData?.[cityName] || null

  // Wait for data to arrive (handles race condition with addCustomCity)
  const [waitingForData, setWaitingForData] = useState(true)
  useEffect(() => {
    setWaitingForData(true)
    const timer = setTimeout(() => setWaitingForData(false), 5000)
    return () => clearTimeout(timer)
  }, [cityName])

  // Stop waiting as soon as data arrives
  useEffect(() => {
    if (city && detailData) setWaitingForData(false)
  }, [city, detailData])

  const current   = detailData?.current
  const air       = detailData?.airQuality
  const forecast  = detailData?.forecast  || []
  const hourly    = detailData?.hourly    || []

  const riskScore = detailData?.combinedRisk ?? 0
  const riskBand  = getRiskBand(riskScore)
  const riskLabel = getRiskLabel(riskScore)

  const liveTemp   = useCountUp(current?.temp ?? 0, 900)
  const heatStreak = useMemo(() => findConsecutiveHeatwaveDays(forecast, 43), [forecast])

  const [shareData, setShareData] = useState({ pred2030: null, suhi: null, treesNeeded: null })
  const handleTreesComputed = ({ totalTrees, suhiMean }) => {
    setShareData(prev => ({ ...prev, treesNeeded: totalTrees, suhi: suhiMean }))
  }

  const now = new Date()
  const isCenterOpen = now.getHours() >= 9 && now.getHours() < 20
  const nearestCenter = nearestCenterByCity?.[cityName]

  const cigarettes = Math.round((air?.aqi_value ?? 0) / 22)

  // Show loading skeleton while waiting for data
  if (!city || !detailData) {
    if (waitingForData) {
      return (
        <div className="cdp-root" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(255,68,68,0.3)', borderTop: '4px solid #ff4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <h2 style={{ color: '#fff', margin: 0 }}>{decodeURIComponent(cityName)}</h2>
          <p style={{ color: '#8895b0', margin: 0 }}>Loading city data... · डेटा लोड हो रहा है...</p>
        </div>
      )
    }
    return (
      <div className="cdp-root" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <span style={{ fontSize: 64 }}>🏙️</span>
        <h2 style={{ color: '#fff', margin: 0 }}>{decodeURIComponent(cityName)}</h2>
        <p style={{ color: '#8895b0', margin: 0, textAlign: 'center', maxWidth: 400 }}>
          This city is not available in our database yet. We currently cover 30 major Indian cities.
          <br /><span className="hindi-text">यह शहर अभी हमारे डेटाबेस में उपलब्ध नहीं है।</span>
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            marginTop: 12, background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.3)',
            color: '#ff6666', padding: '12px 28px', borderRadius: 10, cursor: 'pointer',
            fontSize: 15, fontWeight: 600,
          }}
        >← Back to Map</button>
      </div>
    )
  }

  const gradient = tempGradient(current?.temp)

  return (
    <motion.div
      className="cdp-root"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >

      {/* ── HERO HEADER ──────────────────────────────────────────── */}
      <div className="cdp-hero" style={{ background: gradient }}>
        <button
          type="button"
          className="cdp-back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back to Map <span className="hindi-text">नक्शे पर वापस</span>
        </button>

        <div className="cdp-hero-content">
          <div className="cdp-hero-left">
            <div className="cdp-city-name">{city.name}</div>
            <div className="cdp-city-hindi">{city.nameHindi}</div>
            <div className="cdp-city-state">{city.state}</div>
          </div>

          <div className="cdp-hero-center">
            <motion.div
              className="cdp-temp-huge"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5, type: 'spring' }}
            >
              {liveTemp}°C
            </motion.div>
            <div className="cdp-temp-desc">{current?.description}</div>
          </div>

          <div className="cdp-hero-right">
            <motion.div
              className="cdp-risk-badge"
              style={{ background: riskBand.color }}
              animate={riskScore >= 8 ? { scale: [1, 1.06, 1], boxShadow: [`0 0 0 0 ${riskBand.color}88`, `0 0 0 10px transparent`] } : {}}
              transition={{ repeat: Infinity, duration: 1.4 }}
            >
              <div className="cdp-risk-score">{riskScore}/10</div>
              <div className="cdp-risk-label">{riskLabel.label}</div>
              <div className="cdp-risk-hindi">{riskLabel.labelHindi}</div>
            </motion.div>

            <div className="cdp-meta-line">
              Feels like <strong>{current?.feels_like ?? '--'}°C</strong>
            </div>
            <div className="cdp-meta-line">
              {current?._meta?.lastUpdatedLabel || 'Live data'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-COLUMN BODY ────────────────────────────────────────── */}
      <div className="cdp-body">

        {/* Column 1 — Conditions */}
        <motion.div
          className="cdp-col cdp-col-conditions"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Current conditions */}
          <motion.div className="cdp-glass-card" variants={cardVariants}>
            <h3 className="cdp-card-title">🌡️ Live Conditions</h3>
            <div className="cdp-stat-grid">
              <div className="cdp-stat">
                <span className="cdp-stat-label">Temperature</span>
                <span className="cdp-stat-val" style={{ color: '#ff4444' }}>{current?.temp ?? '--'}°C</span>
              </div>
              <div className="cdp-stat">
                <span className="cdp-stat-label">Feels Like</span>
                <span className="cdp-stat-val" style={{ color: '#ff8800' }}>{current?.feels_like ?? '--'}°C</span>
              </div>
              <div className="cdp-stat">
                <span className="cdp-stat-label">Humidity</span>
                <span className="cdp-stat-val" style={{ color: '#4488ff' }}>{current?.humidity ?? '--'}%</span>
              </div>
              <div className="cdp-stat">
                <span className="cdp-stat-label">Wind</span>
                <span className="cdp-stat-val">{current?.wind_speed ?? '--'} km/h {toCompass(current?.wind_direction)}</span>
              </div>
            </div>
          </motion.div>

          {/* AQI card */}
          <motion.div className="cdp-glass-card" variants={cardVariants}>
            <h3 className="cdp-card-title">💨 Air Quality</h3>
            <div className="cdp-aqi-big">{air?.aqi_value ?? '--'}</div>
            <div style={{ color: '#aaa', fontSize: 13 }}>{air?.category} — {air?.category_hindi}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              ≈ smoking {cigarettes} cigarette{cigarettes !== 1 ? 's' : ''} today
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Main pollutant: {air?.main_pollutant || '--'}
            </div>
          </motion.div>

          {/* Risk score */}
          <motion.div className="cdp-glass-card" variants={cardVariants}>
            <h3 className="cdp-card-title">⚠️ Risk Score</h3>
            <div className="cdp-risk-big" style={{ color: riskBand.color }}>{riskScore}<span style={{ fontSize: 18 }}>/10</span></div>
            <div style={{ color: '#aaa', fontSize: 13 }}>{riskLabel.label} — {riskLabel.labelHindi}</div>
          </motion.div>

          {/* Safe hours */}
          <motion.div className="cdp-glass-card" variants={cardVariants}>
            <h3 className="cdp-card-title">🕐 Safe Hours Today</h3>
            <SafeHoursBar hourly={hourly} />
            <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
              ✅ Go out before 9am or after 7pm · सुरक्षित समय
            </p>
          </motion.div>

          {/* Emergency */}
          <motion.div className="cdp-glass-card cdp-emergency-card" variants={cardVariants}>
            <h3 className="cdp-card-title">🚑 Emergency</h3>
            <div className="cdp-emergency-number">📞 108</div>
            <p style={{ fontSize: 12, color: '#aaa' }}>National Emergency · राष्ट्रीय आपातकाल</p>
            <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
              <strong style={{ color: '#ffcc00' }}>Signs of heat stroke:</strong><br />
              Dizziness · No sweating · Confusion<br />
              <span className="hindi-text">चक्कर · पसीना न आना · भ्रम</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Column 2 — Mini Map */}
        <motion.div
          className="cdp-col cdp-col-map"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div className="cdp-glass-card cdp-map-card" variants={cardVariants}>
            <h3 className="cdp-card-title">🗺️ City Location</h3>
            <CityMiniMap city={city} />
            {/* Satellite button */}
            <button
              type="button"
              className="cdp-satellite-btn"
              onClick={() => { onShowHeatOverlay?.(city); navigate('/') }}
            >
              🛰️ View Satellite Heat Map on Main Map
            </button>
          </motion.div>

          {/* Heatwave alert in map column */}
          {heatStreak.days >= 3 && (
            <motion.div
              className="cdp-glass-card cdp-heatwave-alert"
              variants={cardVariants}
              animate={{ scale: [1, 1.01, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              ⚠️ <strong>हीटवेव चेतावनी</strong>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                {city.name} में अगले {heatStreak.days} दिन तापमान 43°C से ऊपर रहेगा।
                दोपहर 11 से 4 बजे घर में रहें।
              </p>
            </motion.div>
          )}

          {/* Nearest cooling center */}
          {nearestCenter && (
            <motion.div className="cdp-glass-card" variants={cardVariants}>
              <h3 className="cdp-card-title">🏠 Nearest Cooling Center</h3>
              <p style={{ fontSize: 14, color: '#eee', marginBottom: 4 }}><strong>{nearestCenter.name}</strong></p>
              <p style={{ fontSize: 12, color: '#aaa' }}>{nearestCenter.address}</p>
              <p style={{ fontSize: 12, color: '#aaa' }}>{nearestCenter.distanceKm?.toFixed(1)} km away</p>
              <p style={{ fontSize: 12, color: '#aaa' }}>
                Open: {nearestCenter.openTime}–{nearestCenter.closeTime}
                &nbsp;·&nbsp;<span style={{ color: isCenterOpen ? '#00cc88' : '#ff4444' }}>
                  {isCenterOpen ? 'Open Now ✅' : 'Closed ⛔'}
                </span>
              </p>
              <a
                className="cdp-directions-btn"
                href={`https://www.google.com/maps/search/?api=1&query=${nearestCenter.latitude},${nearestCenter.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                📍 Get Directions
              </a>
            </motion.div>
          )}
        </motion.div>

        {/* Column 3 — Forecast */}
        <motion.div
          className="cdp-col cdp-col-forecast"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div className="cdp-glass-card" variants={cardVariants}>
            <h3 className="cdp-card-title">📅 5-Day Forecast</h3>
            <ForecastCards forecast={forecast} />
          </motion.div>
        </motion.div>
      </div>

      {/* ── CHARTS ROW ──────────────────────────────── */}
      <motion.div className="cdp-section"
        initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.45 }}>
        <SplitTrendCharts city={city} />
      </motion.div>

      {/* ── ANALYSIS ROW ─────────────────────────────────────────── */}
      <motion.div className="cdp-section cdp-analysis-row"
        initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.45, delay: 0.05 }}>
        <TreePlantingCalculator city={city} detailData={detailData} onTreesComputed={handleTreesComputed} />
        <HeatInequalityPanel cityName={city.name} />
      </motion.div>

      {/* ── NEIGHBORHOOD ROW ─────────────────────────────────────── */}
      <motion.div className="cdp-section"
        initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.45, delay: 0.08 }}>
        <NeighborhoodGrid neighborhood={detailData?.neighborhood} cityHasGEEData={city.hasGEEData} />
      </motion.div>

      {/* ── ADVANCED ROW — stacked vertically ────────────────── */}
      <motion.div className="cdp-section"
        initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.45, delay: 0.1 }}>
        <HeatCalendar city={city} />
        <ShareCard
          city={city}
          currentWeather={current}
          riskScore={riskScore}
          suhi={shareData.suhi}
          treesNeeded={shareData.treesNeeded}
          pred2030={shareData.pred2030}
        />
      </motion.div>

      {/* ── HEAT STROKE SIGNS ──────────────────────────────────── */}
      <div className="cdp-section">
        <div className="cdp-glass-card">
          <h3 className="cdp-card-title">⚠️ Signs of Heat Stroke — हीट स्ट्रोक के लक्षण</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ fontSize: 13, color: '#eee', lineHeight: 2 }}>
              <div>😵 Dizziness</div>
              <div>🚫 No sweating despite heat</div>
              <div>😵‍💫 Confusion / Fainting</div>
              <div>🌡️ Body temp &gt; 104°F (40°C)</div>
              <div>🤢 Nausea / Vomiting</div>
              <div>💓 Rapid heartbeat</div>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 2 }}>
              <div>😵 चक्कर आना</div>
              <div>🚫 गर्मी में पसीना न आना</div>
              <div>😵‍💫 भ्रम / बेहोशी</div>
              <div>🌡️ शरीर का तापमान बहुत अधिक</div>
              <div>🤢 जी मिचलाना / उल्टी</div>
              <div>💓 तेज़ धड़कन</div>
            </div>
          </div>
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)',
            borderRadius: 10, textAlign: 'center'
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#ff4444' }}>📞 Call 108 Immediately</div>
            <div style={{ fontSize: 12, color: '#ffaaaa', marginTop: 4 }}>
              तुरंत 108 पर कॉल करें — National Emergency Helpline
            </div>
          </div>
        </div>
      </div>

    </motion.div>
  )
}
