import { useEffect, useState } from 'react'
import { indianCities } from '../../data/indianCities'
import { fetchERA5Slope, buildCombinedChartData } from '../../utils/mlModels'

const CURRENT_YEAR = 2024

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

export default function PredictionsPanel({ onClose, cityWeatherData }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      setLoading(true)
      const results = []

      for (let i = 0; i < indianCities.length; i++) {
        const city = indianCities[i]
        if (cancelled) return

        try {
          // Single source of truth: clamped ERA5 slope + buildCombinedChartData
          // This matches exactly what the city chart shows
          const era5 = await fetchERA5Slope(city.latitude, city.longitude)

          const { base, pred2030, totalIncrease, combinedSlope } = buildCombinedChartData({
            cityName:  city.name,
            suhiSlope: null,            // table uses OM-only (no GEE per-city fetch here)
            omSlope:   era5.slope,
            hasSuhi:   false,
          })

          const rate = combinedSlope != null
            ? parseFloat((combinedSlope * 10).toFixed(2))
            : null

          results.push({
            name:         city.name,
            nameHindi:    city.nameHindi,
            current:      base,         // SUMMER_BASELINE — same anchor as chart
            pred2030,
            increase:     totalIncrease,
            rate,
            accuracy:     null,         // regression accuracy not applicable with baseline approach
          })
        } catch {
          results.push({ name: city.name, nameHindi: city.nameHindi, current: null })
        }

        setProgress(i + 1)
      }

      if (!cancelled) {
        // Sort: highest increase first; nulls at end
        results.sort((a, b) => {
          if (a.increase == null && b.increase == null) return 0
          if (a.increase == null) return 1
          if (b.increase == null) return -1
          return b.increase - a.increase
        })
        setRows(results)
        setLoading(false)
      }
    }

    loadAll()
    return () => { cancelled = true }
  }, [cityWeatherData])

  const total = indianCities.length


  return (
    <div className="predictions-overlay" role="dialog" aria-modal="true">
      <div className="predictions-panel">
        {/* Header */}
        <div className="predictions-header">
          <div>
            <h2>🔮 India's Hottest Cities by 2030</h2>
            <p className="hindi-text">2030 तक भारत के सबसे गर्म शहर</p>
          </div>
          <button className="predictions-close-btn" onClick={onClose}>✕ Close</button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="predictions-loading">
            <span className="spinner" />
            <span>
              Running ML predictions... ML भविष्यवाणी चल रही है...
              <br />
              <small style={{ color: '#aaa' }}>{progress} / {total} cities</small>
            </span>
            <div className="pred-progress-bar">
              <div className="pred-progress-fill" style={{ width: `${(progress / total) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <>
            <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 12px' }}>
              Based on Open-Meteo historical data (2018–2024) + Linear Regression.
              Sorted by highest projected increase. | लाइव डेटा पर आधारित ML भविष्यवाणी
            </p>
            <div className="predictions-table-wrap">
              <table className="predictions-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>City / शहर</th>
                    <th>Current / अभी</th>
                    <th>2030 Pred.</th>
                    <th>Increase / वृद्धि</th>
                    <th>Rate/decade</th>
                    <th>Accuracy</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.name} className={idx < 5 ? 'pred-row-hot' : ''}>
                      <td style={{ color: '#888', fontSize: 11 }}>{idx + 1}</td>
                      <td>
                        <strong>{row.name}</strong>
                        <br />
                        <small style={{ color: '#888' }}>{row.nameHindi}</small>
                      </td>
                      <td>{row.current != null ? `${row.current.toFixed(1)}°C` : '—'}</td>
                      <td style={{ color: '#ff4444', fontWeight: 600 }}>
                        {row.pred2030 != null ? `${row.pred2030.toFixed(1)}°C` : '—'}
                      </td>
                      <td style={{ color: getIncreaseColor(row.increase), fontWeight: 700 }}>
                        {row.increase != null ? `+${row.increase}°C` : '—'}
                      </td>
                      <td style={{ color: '#c7ccda', fontSize: 12 }}>
                        {row.rate != null ? `${row.rate > 0 ? '+' : ''}${row.rate}°C` : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: row.accuracy > 70 ? '#00cc88' : '#ffcc00' }}>
                        {row.accuracy != null ? `${row.accuracy}%` : '—'}
                      </td>
                      <td style={{ fontSize: 18 }}>{getRiskEmoji(row.increase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: '#666', marginTop: 12, textAlign: 'center' }}>
              ⚠️ Predictions based on recent trends. Actual warming depends on emissions, policy, and land use.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
