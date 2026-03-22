/**
 * ComparePage.jsx — Part 8C, Page 1
 * ==================================
 * Full-page city comparison at /compare
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { calculateCombinedRisk, getRiskBand, getRiskLabel } from '../../utils/calculations'
import { fetchERA5Slope, buildCombinedChartData } from '../../utils/mlModels'
import { isCityAvailable, getTemperatureTrend } from '../../services/geeAPI'
import { computeSuhiSlope } from '../../utils/mlModels'

// ── helpers ───────────────────────────────────────────────────────
function sortedCities(cities) {
  return [...cities].sort((a, b) => a.name.localeCompare(b.name))
}

function metricBar(valA, valB, lowerIsBetter = true) {
  const max = Math.max(valA, valB, 1)
  const pctA = (valA / max) * 100
  const pctB = (valB / max) * 100
  const winnerA = lowerIsBetter ? valA <= valB : valA >= valB
  return { pctA, pctB, winnerA }
}

function useCountUp(target, active, duration = 900) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active || target == null) return
    let start = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(+(p * target).toFixed(1))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, active, duration])
  return val
}

// ── City selector card ────────────────────────────────────────────
function CityCard({ label, cities, cityWeatherData, cityDetailsData, selected, onSelect }) {
  const sorted = useMemo(() => sortedCities(cities), [cities])
  const data   = cityDetailsData?.[selected] || cityWeatherData?.[selected]
  const temp   = data?.current?.temp
  const risk   = data?.combinedRisk ?? calculateCombinedRisk(data?.current || {})
  const band   = getRiskBand(risk)
  const city   = cities.find(c => c.name === selected)

  return (
    <motion.div
      className="cp-city-card"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    >
      <div className="cp-city-card-label">{label}</div>
      <select
        className="cp-city-select"
        value={selected}
        onChange={e => onSelect(e.target.value)}
      >
        {sorted.map(c => (
          <option key={c.name} value={c.name}>{c.name} — {c.nameHindi}</option>
        ))}
      </select>
      {data && (
        <div className="cp-city-card-info">
          <div className="cp-city-temp" style={{ color: temp > 42 ? '#ff4444' : temp > 38 ? '#ff8800' : '#ffcc00' }}>
            {temp ?? '--'}°C
          </div>
          <div className="cp-city-hindi">{city?.nameHindi}</div>
          <div className="cp-risk-pill" style={{ background: band.color }}>
            {getRiskLabel(risk).label}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Single metric row ─────────────────────────────────────────────
function MetricRow({ label, valA, valB, unit = '', lowerIsBetter = true, animate }) {
  const countA = useCountUp(valA, animate)
  const countB = useCountUp(valB, animate)
  if (valA == null || valB == null) return null
  const { pctA, pctB, winnerA } = metricBar(valA, valB, lowerIsBetter)

  return (
    <div className="cp-metric-row">
      <div className="cp-metric-label">{label}</div>
      <div className="cp-metric-bars">
        {/* City A bar */}
        <div className="cp-bar-wrap cp-bar-left">
          <span className="cp-bar-val" style={{ color: winnerA ? '#00cc88' : '#ff4444' }}>
            {typeof valA === 'number' && !Number.isInteger(valA) ? countA.toFixed(1) : Math.round(countA)}{unit}
          </span>
          <motion.div
            className="cp-bar"
            style={{ background: winnerA ? '#00cc88' : '#ff4444' }}
            initial={{ width: 0 }}
            animate={{ width: animate ? `${pctA}%` : 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </div>

        {/* VS dot */}
        <div className="cp-vs-dot" />

        {/* City B bar */}
        <div className="cp-bar-wrap cp-bar-right">
          <motion.div
            className="cp-bar"
            style={{ background: !winnerA ? '#00cc88' : '#ff4444' }}
            initial={{ width: 0 }}
            animate={{ width: animate ? `${pctB}%` : 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          <span className="cp-bar-val" style={{ color: !winnerA ? '#00cc88' : '#ff4444' }}>
            {typeof valB === 'number' && !Number.isInteger(valB) ? countB.toFixed(1) : Math.round(countB)}{unit}
          </span>
        </div>
      </div>
      {/* Winner badge */}
      <div className="cp-winner-badge" style={{ color: '#00cc88' }}>
        {winnerA ? '✅ A wins' : '✅ B wins'}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function ComparePage({ cities, cityWeatherData, cityDetailsData }) {
  const navigate  = useNavigate()
  const sorted    = useMemo(() => sortedCities(cities || []), [cities])
  const [cityA, setCityA] = useState(sorted[0]?.name || '')
  const [cityB, setCityB] = useState(sorted[4]?.name || sorted[1]?.name || '')
  const [pred, setPred]   = useState({})       // { cityName: { pred2030, suhi } }
  const [animate, setAnimate] = useState(false)

  const dataA = cityDetailsData?.[cityA] || cityWeatherData?.[cityA]
  const dataB = cityDetailsData?.[cityB] || cityWeatherData?.[cityB]

  // Trigger bar animation when both cities have data
  useEffect(() => {
    if (dataA && dataB) { setAnimate(false); requestAnimationFrame(() => setAnimate(true)) }
  }, [cityA, cityB, dataA, dataB])

  // Fetch prediction data for both cities
  useEffect(() => {
    const fetchPred = async (cityName, lat, lon) => {
      try {
        const available = await isCityAvailable(cityName)
        let suhiSlope = null, suhiMean = null
        if (available) {
          const trend = await getTemperatureTrend(cityName)
          if (trend?.years?.length) {
            const sr = computeSuhiSlope(trend.years, trend.dayValues)
            suhiSlope = sr?.slope
            suhiMean = trend.dayValues?.filter(v => v != null).reduce((s, v, _, a) => s + v / a.length, 0)
          }
        }
        const era5 = await fetchERA5Slope(lat, lon)
        const { pred2030 } = buildCombinedChartData({ cityName, suhiSlope, omSlope: era5.slope, hasSuhi: available && suhiSlope != null })
        setPred(p => ({ ...p, [cityName]: { pred2030, suhi: suhiMean } }))
      } catch { /* silent */ }
    }

    const cityObjA = cities?.find(c => c.name === cityA)
    const cityObjB = cities?.find(c => c.name === cityB)
    if (cityObjA) fetchPred(cityA, cityObjA.latitude, cityObjA.longitude)
    if (cityObjB) fetchPred(cityB, cityObjB.latitude, cityObjB.longitude)
  }, [cityA, cityB, cities])

  const comparison = useMemo(() => {
    if (!dataA || !dataB) return null
    const cA = dataA.current, cB = dataB.current
    const aqiA = dataA.airQuality?.aqi_value ?? 100
    const aqiB = dataB.airQuality?.aqi_value ?? 100
    const riskA = dataA.combinedRisk ?? calculateCombinedRisk({ ...cA, aqi_value: aqiA })
    const riskB = dataB.combinedRisk ?? calculateCombinedRisk({ ...cB, aqi_value: aqiB })
    const safeA = (dataA.hourly || []).filter(e => e.risk_level <= 4).length * 3
    const safeB = (dataB.hourly || []).filter(e => e.risk_level <= 4).length * 3
    const tempDiff = ((cA?.temp ?? 0) - (cB?.temp ?? 0)).toFixed(1)
    const aqiRatio = aqiA > 0 && aqiB > 0 ? (aqiA / aqiB).toFixed(1) : null
    return { cA, cB, aqiA, aqiB, riskA, riskB, safeA, safeB, tempDiff, aqiRatio }
  }, [dataA, dataB])

  const METRICS = comparison ? [
    { label: '🌡️ Temperature',    valA: comparison.cA?.temp,       valB: comparison.cB?.temp,       unit: '°C', lowerIsBetter: true },
    { label: '🥵 Feels Like',     valA: comparison.cA?.feels_like, valB: comparison.cB?.feels_like, unit: '°C', lowerIsBetter: true },
    { label: '💧 Humidity',       valA: comparison.cA?.humidity,   valB: comparison.cB?.humidity,   unit: '%',  lowerIsBetter: false },
    { label: '💨 AQI',            valA: comparison.aqiA,           valB: comparison.aqiB,           unit: '',   lowerIsBetter: true },
    { label: '⚠️ Risk Score',     valA: comparison.riskA,         valB: comparison.riskB,          unit: '/10',lowerIsBetter: true },
    { label: '🕐 Safe Hours',     valA: comparison.safeA,          valB: comparison.safeB,          unit: 'h',  lowerIsBetter: false },
    { label: '🛰️ SUHI Intensity', valA: pred[cityA]?.suhi,         valB: pred[cityB]?.suhi,         unit: '°C', lowerIsBetter: true },
    { label: '🔮 2030 Forecast',  valA: pred[cityA]?.pred2030,     valB: pred[cityB]?.pred2030,     unit: '°C', lowerIsBetter: true },
  ] : []

  // Key insight
  const insight = useMemo(() => {
    if (!comparison) return null
    const { cA, cB, aqiA, aqiB, tempDiff, aqiRatio } = comparison
    const hotter = parseFloat(tempDiff)
    const city1 = hotter >= 0 ? cityA : cityB
    const city2 = hotter >= 0 ? cityB : cityA
    const absDiff = Math.abs(hotter).toFixed(1)
    let txt = `${city1} is ${absDiff}°C hotter than ${city2}`
    if (aqiRatio && parseFloat(aqiRatio) > 1.5) txt += ` and has ${aqiRatio}× worse air quality`
    txt += '.'
    return txt
  }, [comparison, cityA, cityB])

  return (
    <motion.div
      style={{ minHeight: '100vh', background: '#0f1117', padding: '20px 24px 60px' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
    >
      {/* Back */}
      <button className="cdp-back-btn" onClick={() => navigate(-1)}>← Back</button>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0 }}>⚖️ Compare Cities</h1>
        <p className="hindi-text" style={{ color: '#aaa', marginTop: 4 }}>शहरों की तुलना करें</p>
      </div>

      {/* City selectors */}
      <div className="cp-selectors">
        <CityCard label="🏙️ City A" cities={sorted} cityWeatherData={cityWeatherData}
          cityDetailsData={cityDetailsData} selected={cityA} onSelect={v => { setCityA(v); setAnimate(false) }} />

        {/* VS divider */}
        <motion.div className="cp-vs-divider"
          animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
          VS
        </motion.div>

        <CityCard label="🏙️ City B" cities={sorted} cityWeatherData={cityWeatherData}
          cityDetailsData={cityDetailsData} selected={cityB} onSelect={v => { setCityB(v); setAnimate(false) }} />
      </div>

      {/* Comparison metrics */}
      {comparison ? (
        <motion.div className="cp-metrics-wrap"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>

          {/* Column headers */}
          <div className="cp-col-headers">
            <span style={{ color: '#ff6666', fontWeight: 700 }}>{cityA}</span>
            <span style={{ color: '#888', fontSize: 12 }}>METRIC</span>
            <span style={{ color: '#66aaff', fontWeight: 700 }}>{cityB}</span>
          </div>

          {METRICS.map(m => (
            <MetricRow key={m.label} {...m} animate={animate} />
          ))}

          {/* Key Insight */}
          {insight && (
            <motion.div className="cp-insight-card"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                💡 Key Insight
              </div>
              <div style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>{insight}</div>
              <div className="hindi-text" style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>
                {cityA} और {cityB} की तुलनात्मक विश्लेषण
              </div>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <div style={{ textAlign: 'center', color: '#666', marginTop: 40 }}>
          <div className="spinner" />
          <p>Loading weather data… मौसम डेटा लोड हो रहा है</p>
        </div>
      )}
    </motion.div>
  )
}
