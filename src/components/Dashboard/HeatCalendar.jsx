/**
 * HeatCalendar.jsx — ThermalBharat Part 7, Feature 2
 * =======================================================
 * GitHub-style heatmap calendar using Open-Meteo historical data.
 * Shows daily max temperature for the last 2 years.
 */

import { useEffect, useState } from 'react'

// ── Color scale by temperature ──────────────────────────────────
function tempColor(t) {
  if (t === null || t === undefined) return '#1a1d2e'
  if (t < 35)  return '#313695'
  if (t < 38)  return '#74add1'
  if (t < 41)  return '#fed976'
  if (t < 44)  return '#fd8d3c'
  if (t < 47)  return '#e31a1c'
  return '#b10026'
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_NAMES_HI = ['जन','फर','मार','अप्र','मई','जून','जुल','अग','सित','अक्त','नव','दिस']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Fetch historical daily max temp from Open-Meteo ─────────────
async function fetchCalendarData(lat, lon) {
  const end   = new Date()
  const start = new Date()
  start.setFullYear(start.getFullYear() - 2)

  const fmt = (d) => d.toISOString().slice(0, 10)
  const url  = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
               `&start_date=${fmt(start)}&end_date=${fmt(end)}&daily=temperature_2m_max&timezone=Asia%2FKolkata`

  const res  = await fetch(url)
  const json = await res.json()

  const dates = json.daily?.time || []
  const temps = json.daily?.temperature_2m_max || []
  return dates.map((date, i) => ({ date, temp: temps[i] !== null ? Math.round(temps[i]) : null }))
}

// ── Calendar grid ────────────────────────────────────────────────
function CalendarGrid({ data }) {
  const [tooltip, setTooltip] = useState(null)

  // Group by week columns starting from Sunday
  const firstDay  = data[0] ? new Date(data[0].date).getDay() : 0
  const cells     = Array(firstDay).fill(null).concat(data)

  // Group into weeks
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  // Month label positions (which week index does each month start?)
  const monthStarts = {}
  data.forEach((d, idx) => {
    const adjusted = idx + firstDay
    const weekIdx  = Math.floor(adjusted / 7)
    const month    = d.date.slice(0, 7)   // "2024-03"
    if (!(month in monthStarts)) monthStarts[month] = weekIdx
  })

  // Unique months in display order
  const months = Object.keys(monthStarts).sort()

  return (
    <div className="cal-outer">
      {/* Month labels row */}
      <div className="cal-month-row" style={{ gridTemplateColumns: `repeat(${weeks.length}, 13px)` }}>
        {weeks.map((_, wi) => {
          const mo = months.find(m => monthStarts[m] === wi)
          return <div key={wi} className="cal-month-label">{mo ? MONTH_NAMES[parseInt(mo.slice(5,7))-1] : ''}</div>
        })}
      </div>

      <div className="cal-main">
        {/* Day-of-week labels */}
        <div className="cal-day-col">
          {DAY_NAMES.map((d, i) => (
            <div key={d} className="cal-day-label">{i % 2 === 0 ? d : ''}</div>
          ))}
        </div>

        {/* Week columns */}
        <div className="cal-weeks" style={{ gridTemplateColumns: `repeat(${weeks.length}, 13px)` }}>
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) return <div key={`e-${wi}-${di}`} className="cal-cell empty" />
              const color = tempColor(cell.temp)
              return (
                <div
                  key={cell.date}
                  className="cal-cell"
                  style={{ background: color }}
                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, ...cell })}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })
          )}
        </div>
      </div>

      {tooltip && (
        <div className="cal-tooltip" style={{ top: tooltip.y - 48, left: tooltip.x - 60 }}>
          📅 {tooltip.date}: {tooltip.temp !== null ? `${tooltip.temp}°C` : 'No data'}
        </div>
      )}
    </div>
  )
}

// ── Legend ───────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: '#313695', label: '<35°C' },
    { color: '#74add1', label: '35-38°C' },
    { color: '#fed976', label: '38-41°C' },
    { color: '#fd8d3c', label: '41-44°C' },
    { color: '#e31a1c', label: '44-47°C' },
    { color: '#b10026', label: '>47°C' },
  ]
  return (
    <div className="cal-legend">
      <span className="cal-legend-label">Less</span>
      {items.map(i => (
        <div key={i.label} className="cal-legend-item" title={i.label}>
          <div className="cal-legend-cell" style={{ background: i.color }} />
          <span>{i.label}</span>
        </div>
      ))}
      <span className="cal-legend-label">More heat</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────
export default function HeatCalendar({ city }) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!city?.latitude || !city?.longitude) return
    setLoading(true); setError(null); setData([])
    fetchCalendarData(city.latitude, city.longitude)
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [city?.name])

  // Compute summary stats
  const validDays = data.filter(d => d.temp !== null)
  const hottest   = validDays.reduce((max, d) => d.temp > (max?.temp ?? -999) ? d : max, null)
  const hwDays    = validDays.filter(d => d.temp >= 43).length

  return (
    <div className="detail-card cal-panel">
      <h4>
        📅 Heat Calendar
        <span className="hindi-text"> — ताप कैलेंडर</span>
      </h4>
      <p className="ineq-subtitle">Daily max temperature — last 2 years (Open-Meteo ERA5)</p>

      {loading && <div className="cal-loading">⏳ Loading 2 years of data…</div>}
      {error   && <div className="cal-error">⚠️ {error}</div>}

      {data.length > 0 && !loading && (
        <>
          <CalendarGrid data={data} />
          <Legend />

          <div className="cal-stats">
            {hottest && (
              <div className="cal-stat-item">
                🌡️ <strong>Hottest day:</strong> {hottest.date} — <span style={{ color: '#ff4444' }}>{hottest.temp}°C</span>
                <br />
                <span className="hindi-text" style={{ fontSize: 11 }}>
                  सबसे गर्म दिन: {new Date(hottest.date).toLocaleDateString('hi-IN', { day: 'numeric', month: 'long' })} — {hottest.temp}°C
                </span>
              </div>
            )}
            <div className="cal-stat-item">
              🔥 <strong>Heatwave days (≥43°C):</strong>{' '}
              <span style={{ color: '#fd8d3c' }}>{hwDays} days</span>
              <br />
              <span className="hindi-text" style={{ fontSize: 11 }}>हीटवेव दिन (43°C+): {hwDays} दिन</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
