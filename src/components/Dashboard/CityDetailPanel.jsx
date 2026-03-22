import { useEffect, useMemo, useState } from 'react'
import {
  Area, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import {
  findConsecutiveHeatwaveDays,
  getHeatLevel,
  getHindiDayName,
  getRiskBand,
  getRiskLabel
} from '../../utils/calculations'
import {
  getTemperatureTrend,
  isCityAvailable,
} from '../../services/geeAPI'
import {
  fetchERA5Slope, getBaselineTemp,
  computeSuhiSlope, buildCombinedChartData,
} from '../../utils/mlModels'
import TreePlantingCalculator from './TreePlantingCalculator'
import HeatInequalityPanel   from './HeatInequalityPanel'
import HeatCalendar          from './HeatCalendar'
import ShareCard             from './ShareCard'

function toCompass(deg = 0) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

// ── Safe hours section ─────────────────────────────────────────
function SafeHours({ hourly }) {
  if (!hourly?.length) return null
  const safeSlots = hourly.filter((slot) => slot.risk_level <= 4)
  const before = safeSlots.find((slot) => /am/i.test(slot.hour))
  const after = [...safeSlots].reverse().find((slot) => /pm/i.test(slot.hour))
  const beforeText = before?.hour || '8am'
  const afterText = after?.hour || '7pm'
  const beforeHindi = beforeText.replace(/am/i, ' बजे')
  const afterHindi = afterText.replace(/pm/i, ' बजे')

  return (
    <div className="detail-card">
      <h4>Safe Hours Today</h4>
      <div className="timeline-grid">
        {hourly.map((slot, index) => {
          let color = '#00cc88'
          if (slot.risk_level > 7) color = '#ff4444'
          else if (slot.risk_level > 5) color = '#ff8800'
          else if (slot.risk_level > 3) color = '#ffcc00'
          return (
            <div key={`${slot.hour}-${index}`} className="hour-slot" style={{ backgroundColor: color }}>
              <small>{slot.hour}</small>
            </div>
          )
        })}
      </div>
      <p>✅ Safe to go out: Before {beforeText} and After {afterText}</p>
      <p className="hindi-text">
        सुरक्षित समय: सुबह {beforeHindi} से पहले और शाम {afterHindi} के बाद
      </p>
      <p className="meta-inline">{hourly?._meta?.lastUpdatedLabel || 'Last updated now'}</p>
    </div>
  )
}

// ── Neighborhood grid ──────────────────────────────────────────
function NeighborhoodGrid({ neighborhood, cityHasGEEData }) {
  if (!neighborhood?.length) return null
  return (
    <div className="detail-card">
      <h4>
        {cityHasGEEData
          ? 'Neighborhood temperature variation'
          : 'Approximate neighborhood differences'}
      </h4>
      <div className="neighborhood-grid">
        {neighborhood.map((entry) => (
          <div key={entry.direction} className="neighborhood-cell" style={{ borderColor: entry.color }}>
            <strong>{entry.direction}</strong>
            <span>{entry.temperature}°C</span>
          </div>
        ))}
      </div>
      {!cityHasGEEData ? (
        <p className="hindi-text">
          Approximate neighborhood data. Satellite data not available.
          <br />
          अनुमानित पड़ोस डेटा। सैटेलाइट डेटा उपलब्ध नहीं है।
        </p>
      ) : (
        <p className="hindi-text">ℹ️ सैटेलाइट डेटा उपलब्ध है।</p>
      )}
    </div>
  )
}

// ── Heat stroke section ────────────────────────────────────────
function HeatStrokeSection() {
  const [open, setOpen] = useState(false)
  return (
    <div className="detail-card">
      <button type="button" className="collapse-btn" onClick={() => setOpen((prev) => !prev)}>
        ⚠️ Signs of Heat Stroke
      </button>
      {open ? (
        <div className="collapse-content">
          <p>Dizziness | चक्कर आना</p>
          <p>No sweating despite heat | गर्मी में पसीना न आना</p>
          <p>Confusion | भ्रम</p>
          <p>High body temperature | शरीर का तापमान बहुत अधिक</p>
          <p className="danger-line">Call 108 immediately</p>
        </div>
      ) : null}
    </div>
  )
}

// ── Chart 1: Heat Island Intensity 2003-2018 (Yale SUHI) ───────
function SuhiIntensityChart({ data, cityName }) {
  if (!data.length) return null
  return (
    <div className="detail-card" style={{ marginBottom: 8 }}>
      <h4 style={{ marginBottom: 4 }}>
        🛰️ Heat Island Intensity (2003–2018)
        <span style={{ fontSize: 11, fontWeight: 400, color: '#aaa', marginLeft: 6 }}>
          ताप द्वीप तीव्रता
        </span>
      </h4>
      <div className="suhi-chart-wrap">
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={data} margin={{ top: 6, right: 14, left: -10, bottom: 0 }}>
            <XAxis
              dataKey="year"
              stroke="#c7ccda"
              tick={{ fontSize: 10 }}
              interval={2}
              tickFormatter={v => `'${String(v).slice(2)}`}
            />
            <YAxis
              stroke="#c7ccda"
              tick={{ fontSize: 10 }}
              tickFormatter={v => `${v}°`}
              domain={[0, 8]}
              label={{ value: '°C above rural', angle: -90, position: 'insideLeft', fontSize: 9, fill: '#888', dx: 10 }}
            />
            <Tooltip
              contentStyle={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#c7ccda' }}
              formatter={(val) => val != null ? [`${val.toFixed(2)}°C above rural`, '🛰️ SUHI Intensity'] : null}
            />
            <Line
              type="monotone"
              dataKey="intensity"
              stroke="#ff8800"
              strokeWidth={2.5}
              dot={{ fill: '#ff8800', r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
        How much hotter than surrounding rural areas · ग्रामीण क्षेत्रों से कितना अधिक गर्म
      </p>
      <small className="suhi-credit">Source: Yale YCEO / NASA MODIS Global Urban Heat Island Dataset</small>
    </div>
  )
}

// ── Chart 2: Combined 22-Year Temperature Journey (2003-2030) ───
function CombinedTrendChart({ data, base, pred2030, totalIncrease, combinedSlope, method, cityName }) {
  const increaseColor = !isFinite(totalIncrease) ? '#aaa'
    : totalIncrease < 1 ? '#00cc88'
    : totalIncrease < 2 ? '#ffcc00'
    : totalIncrease < 3 ? '#ff8800'
    : '#ff4444'

  return (
    <div className="detail-card full-trend-chart">
      <h4 style={{ marginBottom: 4 }}>
        🌡️ 22-Year Temperature Journey &amp; 2030 Prediction
        <span style={{ fontSize: 11, fontWeight: 400, color: '#aaa', marginLeft: 6 }}>
          तापमान सफर और 2030 भविष्यवाणी
        </span>
      </h4>

      <div className="suhi-chart-wrap">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 8, right: 14, left: -10, bottom: 0 }}>
            <XAxis
              dataKey="year"
              stroke="#c7ccda"
              tick={{ fontSize: 10 }}
              interval={2}
              tickFormatter={v => `'${String(v).slice(2)}`}
            />
            <YAxis
              stroke="#c7ccda"
              tick={{ fontSize: 10 }}
              tickFormatter={v => `${v}°`}
              domain={[28, 50]}
            />
            <Tooltip
              contentStyle={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#c7ccda' }}
              formatter={(val, name) => {
                if (val == null) return null
                const labels = {
                  suhi_seg: '🛰️ Satellite (Yale)',
                  om_seg:   '📡 Open-Meteo',
                  pred_seg: '🤖 Prediction',
                  bandHigh: null, bandLow: null,
                }
                if (!labels[name]) return null
                return [`${val.toFixed(1)}°C`, labels[name]]
              }}
            />

            {/* Dividers at data-source transitions */}
            <ReferenceLine x={2018} stroke="#444" strokeDasharray="3 3"
              label={{ value: "'18", position: 'top', fontSize: 9, fill: '#666' }} />
            <ReferenceLine x={2024} stroke="#555" strokeDasharray="4 2"
              label={{ value: '2024 →predict', position: 'top', fontSize: 9, fill: '#888' }} />

            {/* ±0.5°C confidence band */}
            <Area type="monotone" dataKey="bandHigh" stroke="transparent"
              fill="#ff444422" legendType="none" connectNulls dot={false} />
            <Area type="monotone" dataKey="bandLow" stroke="transparent"
              fill="#0f111700" legendType="none" connectNulls dot={false} />

            {/* Segment 1: Yale SUHI normalized (2003–2018) */}
            <Line type="monotone" dataKey="suhi_seg" name="suhi_seg"
              stroke="#ff8800" strokeWidth={2.5} dot={{ fill: '#ff8800', r: 2.5 }} connectNulls />

            {/* Segment 2: Open-Meteo normalized (2018–2024) */}
            <Line type="monotone" dataKey="om_seg" name="om_seg"
              stroke="#00cc88" strokeWidth={2.5} dot={{ fill: '#00cc88', r: 2.5 }} connectNulls />

            {/* Segment 3: ML Prediction (2024–2030) */}
            <Line type="monotone" dataKey="pred_seg" name="pred_seg"
              stroke="#ff4444" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="suhi-legend" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span><span className="suhi-dot" style={{ background: '#ff8800' }} /> 🛰️ Satellite Data (Yale 2003–18)</span>
        <span><span className="suhi-dot" style={{ background: '#00cc88' }} /> 📡 Measured (Open-Meteo 2018–24)</span>
        <span><span className="suhi-dot" style={{ background: '#ff4444' }} /> 🤖 ML Prediction (2024–30)</span>
        <span>
          <span className="suhi-dot" style={{ background: '#ff444433', border: '1px solid #ff4444', borderRadius: 2, width: 16, height: 8, display: 'inline-block', verticalAlign: 'middle' }} />
          {' '}±0.5°C band
        </span>
      </div>

      {/* Prediction summary card */}
      {pred2030 != null && base != null && (
        <div className="prediction-card">
          <h5 style={{ margin: '10px 0 6px', color: '#c7ccda', fontSize: 13 }}>
            🔮 2030 Prediction — {cityName}
            <span className="hindi-text" style={{ fontSize: 11, marginLeft: 6 }}>2030 तक भविष्यवाणी</span>
          </h5>
          <div className="prediction-grid">
            <div className="pred-item">
              <span className="pred-label">2024 Summer baseline / गर्मी आधार</span>
              <span className="pred-value">{base.toFixed(1)}°C</span>
            </div>
            <div className="pred-item">
              <span className="pred-label">Predicted 2030 / 2030 अनुमान</span>
              <span className="pred-value" style={{ color: '#ff4444' }}>{pred2030.toFixed(1)}°C</span>
            </div>
            <div className="pred-item">
              <span className="pred-label">Total increase / कुल वृद्धि</span>
              <span className="pred-value" style={{ color: increaseColor }}>+{totalIncrease?.toFixed(2)}°C</span>
            </div>
            <div className="pred-item">
              <span className="pred-label">Rate / दर</span>
              <span className="pred-value">{combinedSlope ? (combinedSlope * 10).toFixed(2) : '--'}°C/decade</span>
            </div>
          </div>
        </div>
      )}

      <small className="suhi-credit">
        {method === 'combined'
          ? '22-yr combined: Yale SUHI (70% weight) + ERA5 Open-Meteo (30%) | Anchor: IMD summer baseline'
          : 'ERA5 Open-Meteo trend | Anchor: IMD summer baseline (no satellite data for this city)'}
      </small>
    </div>
  )
}


// ── Wrapper: loads SUHI + ERA5, builds combined 3-segment chart ──
export function SplitTrendCharts({ city }) {
  const [suhiData,      setSuhiData]      = useState([])   // for SUHI intensity card (0-8°C)
  const [chartData,     setChartData]     = useState([])   // combined 2003-2030 chart
  const [chartMeta,     setChartMeta]     = useState(null) // {base, pred2030, totalIncrease, combinedSlope, method}
  const [hasGEE,        setHasGEE]        = useState(false)
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!city) return
    let cancelled = false
    setLoading(true)
    setSuhiData([])
    setChartData([])
    setChartMeta(null)

    async function load() {
      // 1. Yale SUHI data (2003-2018) — for intensity card + slope extraction
      const available = await isCityAvailable(city.name)
      let sPoints = []
      let suhiSlope = null

      if (available) {
        const trend = await getTemperatureTrend(city.name)
        if (trend?.years?.length) {
          sPoints = trend.years
            .map((yr, i) => ({ year: parseInt(yr), intensity: trend.dayValues[i] }))
            .filter(p => p.intensity != null)
          // Compute warming rate from Yale SUHI data
          const sr = computeSuhiSlope(trend.years, trend.dayValues)
          suhiSlope = sr?.slope ?? null
        }
      }

      // 2. ERA5 Open-Meteo Apr-Jun slope (2018-2024)
      const era5 = await fetchERA5Slope(city.latitude, city.longitude)

      if (cancelled) return

      // 3. Build 3-segment combined chart (all normalized to SUMMER_BASELINE)
      const result = buildCombinedChartData({
        cityName:  city.name,
        suhiSlope,
        omSlope:   era5.slope,
        hasSuhi:   available && suhiSlope != null,
      })

      if (!cancelled) {
        setHasGEE(available)
        setSuhiData(sPoints)
        setChartData(result.chartData)
        setChartMeta(result)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [city])

  if (loading) return (
    <div className="detail-card">
      <h4>📊 Temperature Charts / तापमान चार्ट</h4>
      <div className="suhi-loading">
        <span className="spinner" />
        <span>Combining 22 years of data... 22 वर्षों का डेटा विश्लेषण...</span>
      </div>
    </div>
  )

  return (
    <>
      {/* SUHI intensity card — separate 0-8°C scale (scientific meaning) */}
      {hasGEE && suhiData.length > 0 && (
        <SuhiIntensityChart data={suhiData} cityName={city.name} />
      )}

      {/* Combined 22-year temperature journey — all on one 28-50°C Y-axis */}
      <CombinedTrendChart
        data={chartData}
        base={chartMeta?.base}
        pred2030={chartMeta?.pred2030}
        totalIncrease={chartMeta?.totalIncrease}
        combinedSlope={chartMeta?.combinedSlope}
        method={chartMeta?.method}
        cityName={city.name}
      />
    </>
  )
}


// ── CityDetailPanel (main) ─────────────────────────────────────
function CityDetailPanel({ city, detailData, nearestCenter, onClose, onShowHeatOverlay }) {
  const current = detailData?.current
  const air = detailData?.airQuality
  const forecast = detailData?.forecast || []
  const hourly = detailData?.hourly || []
  const historical = detailData?.historical
  const neighborhood = detailData?.neighborhood

  const riskScore = detailData?.combinedRisk ?? 0
  const riskBand = getRiskBand(riskScore)
  const riskLabel = getRiskLabel(riskScore)

  // Share card: pred2030 + suhi from ML model; treesNeeded comes from TreePlantingCalculator callback
  const [shareData, setShareData] = useState({ pred2030: null, suhi: null, treesNeeded: null })
  const [geeAvailable, setGeeAvailable] = useState(false)

  useEffect(() => {
    if (!city) return
    isCityAvailable(city.name).then(setGeeAvailable)
  }, [city])

  // Fetch pred2030 only (trees+suhi come from TreePlantingCalculator callback)
  useEffect(() => {
    if (!city) return
    let cancelled = false
    async function loadPred() {
      try {
        const available = await isCityAvailable(city.name)
        let suhiSlope = null
        if (available) {
          const trend = await getTemperatureTrend(city.name)
          if (trend?.years?.length) {
            const sr = computeSuhiSlope(trend.years, trend.dayValues)
            suhiSlope = sr?.slope ?? null
          }
        }
        const era5   = await fetchERA5Slope(city.latitude, city.longitude)
        const result = buildCombinedChartData({
          cityName: city.name, suhiSlope,
          omSlope: era5.slope, hasSuhi: available && suhiSlope != null,
        })
        if (!cancelled) setShareData(prev => ({ ...prev, pred2030: result.pred2030 ?? null }))
      } catch { /* non-critical */ }
    }
    loadPred()
    return () => { cancelled = true }
  }, [city])

  // Called by TreePlantingCalculator — same value shown in tree display
  const handleTreesComputed = ({ totalTrees, suhiMean }) => {
    setShareData(prev => ({
      ...prev,
      treesNeeded: totalTrees ?? null,
      suhi: suhiMean !== null ? parseFloat(suhiMean.toFixed(1)) : prev.suhi,
    }))
  }

  const cigarettes = useMemo(() => {
    const aqiVal = air?.aqi_value ?? 0
    return (aqiVal / 22).toFixed(1)
  }, [air?.aqi_value])

  const trendChartData = useMemo(() => {
    if (!historical?.years?.length) return []
    return historical.years.map((year, index) => ({
      year,
      temp: historical.avg_max_temps[index]
    }))
  }, [historical])

  const heatwaveStreak = useMemo(() => {
    return findConsecutiveHeatwaveDays(forecast, 43)
  }, [forecast])

  const hasCachedData =
    Boolean(current?._meta?.usingCached) ||
    Boolean(air?._meta?.usingCached) ||
    Boolean(forecast?._meta?.usingCached) ||
    Boolean(hourly?._meta?.usingCached)

  const cacheWarning =
    current?._meta?.warning ||
    air?._meta?.warning ||
    forecast?._meta?.warning ||
    hourly?._meta?.warning ||
    ''

  const now = new Date()
  const currentHour = now.getHours()
  const isCenterOpen = currentHour >= 9 && currentHour < 20

  if (!city || !detailData) return null

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <div>
          <h2>{city.name}</h2>
          <p>{city.nameHindi}</p>
          <small>{city.state}</small>
        </div>
        <button type="button" onClick={onClose}>✕</button>
      </div>

      {/* Satellite heat map button */}
      <div className="detail-card" style={{ paddingTop: 12, paddingBottom: 12 }}>
        {geeAvailable ? (
          <button
            type="button"
            className="satellite-btn"
            onClick={() => onShowHeatOverlay(city)}
          >
            🛰️ Show Satellite Heat Map
          </button>
        ) : (
          <div className="satellite-unavailable">
            <p>Satellite data not yet available for this city.<br />Showing live weather data only.</p>
            <small>Run <code>gee_export.py</code> (Tier 1/2/3) to enable this feature.</small>
          </div>
        )}
      </div>

      <div className="detail-card">
        <div className="temp-row">
          <span className="temp-main">{current?.temp ?? '--'}°C</span>
          <span className="temp-sub">Feels like {current?.feels_like ?? '--'}°C</span>
        </div>
        <p>Humidity: {current?.humidity ?? '--'}%</p>
        <p>Wind: {current?.wind_speed ?? '--'} km/h ({toCompass(current?.wind_direction)})</p>
        <p>{current?.description}</p>
        <p>{current?._meta?.lastUpdatedLabel || 'Last updated now'}</p>
        <span className="risk-chip large" style={{ backgroundColor: riskBand.color }}>
          {riskLabel.label} | {riskLabel.labelHindi}
        </span>
        {hasCachedData ? <p className="cache-warning">⚠ {cacheWarning || 'Using cached data'}</p> : null}
      </div>

      <div className="detail-card">
        <h4>Combined Risk Score (0-10)</h4>
        <div className="score-big" style={{ color: riskBand.color }}>{riskScore}</div>
        <p>{riskLabel.label} | {riskLabel.labelHindi}</p>
        <p className="hindi-text">व्यक्तिगत जोखिम स्कोर</p>
      </div>

      <div className="detail-card">
        <h4>Air Quality</h4>
        <div className="aqi-main">AQI {air?.aqi_value ?? '--'}</div>
        <p>{air?.category} | {air?.category_hindi}</p>
        <p>Main pollutant: {air?.main_pollutant || '--'}</p>
        <p>Today's air = smoking {cigarettes} cigarettes</p>
        <p>{air?._meta?.lastUpdatedLabel || 'Last updated now'}</p>
      </div>

      <SafeHours hourly={hourly} />

      <div className="detail-card forecast-row">
        <h4>5 Day Forecast</h4>
        <p className="meta-inline">{forecast?._meta?.lastUpdatedLabel || 'Last updated now'}</p>
        <div className="forecast-grid">
          {forecast.map((day) => {
            const level = getHeatLevel(day.max_temp)
            return (
              <div key={day.date} className="forecast-card" style={{ borderColor: level.color }}>
                <strong>{day.day_name}</strong>
                <small>{getHindiDayName(day.day_name)}</small>
                <img
                  className="forecast-icon"
                  src={`https://openweathermap.org/img/wn/${day.icon || '01d'}.png`}
                  alt={day.description}
                />
                <span>{day.min_temp}° / {day.max_temp}°</span>
                <small>{day.description}</small>
              </div>
            )
          })}
        </div>
      </div>

      {heatwaveStreak.days >= 3 ? (
        <div className="heatwave-detail-alert">
          ⚠️ हीटवेव चेतावनी
          <p>{city.name} में अगले {heatwaveStreak.days} दिन तापमान 43°C से ऊपर रहेगा</p>
        </div>
      ) : null}

      {/* Part 5 — Two separate charts: SUHI intensity + Temp prediction */}
      <SplitTrendCharts city={city} />

      {/* Part 7 — Tree calculator */}
      <TreePlantingCalculator city={city} detailData={detailData} onTreesComputed={handleTreesComputed} />

      {/* Part 7F1 — Heat Inequality */}
      <HeatInequalityPanel cityName={city.name} />

      {/* Part 7F2 — Heat Calendar */}
      <HeatCalendar city={city} />

      {/* Part 7F3 — Share Card */}
      <ShareCard
        city={city}
        currentWeather={current}
        riskScore={riskScore}
        suhi={shareData.suhi}
        treesNeeded={shareData.treesNeeded}
        pred2030={shareData.pred2030}
      />



      <NeighborhoodGrid neighborhood={neighborhood} cityHasGEEData={city.hasGEEData} />

      <div className="detail-card">
        <h4>Nearest Cooling Center</h4>
        {nearestCenter ? (
          <>
            <p>{nearestCenter.name}</p>
            <p>{nearestCenter.address}</p>
            <p>{nearestCenter.distanceKm.toFixed(1)} km away</p>
            <p>Open: {nearestCenter.openTime} - {nearestCenter.closeTime}</p>
            <p>Status: {isCenterOpen ? 'Open' : 'Closed'}</p>
            <a
              className="directions-btn"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${nearestCenter.latitude},${nearestCenter.longitude}`}
            >
              Get Directions
            </a>
          </>
        ) : (
          <p>No cooling center mapped yet.</p>
        )}
      </div>

      <HeatStrokeSection />
    </aside>
  )
}

export default CityDetailPanel
