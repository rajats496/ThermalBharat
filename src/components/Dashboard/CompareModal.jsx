import { useMemo, useState } from 'react'
import { calculateCombinedRisk, getRiskBand } from '../../utils/calculations'

function metricColor(value, type) {
  if (type === 'aqi') {
    if (value <= 50) return '#00cc88'
    if (value <= 100) return '#ffcc00'
    if (value <= 150) return '#ff8800'
    return '#ff4444'
  }
  if (type === 'temp') {
    if (value <= 35) return '#00cc88'
    if (value <= 38) return '#ffcc00'
    if (value <= 42) return '#ff8800'
    return '#ff4444'
  }
  if (value <= 3) return '#00cc88'
  if (value <= 5) return '#ffcc00'
  if (value <= 7) return '#ff8800'
  return '#ff4444'
}

function CompareModal({ isOpen, onClose, cities, cityWeatherData, cityDetailsData }) {
  const [cityA, setCityA] = useState(cities[0]?.name || '')
  const [cityB, setCityB] = useState(cities[1]?.name || '')
  const [showResult, setShowResult] = useState(false)

  function valueClass(metric, current, other) {
    if (metric === 'safeHours') {
      return current < other ? 'worse-cell' : ''
    }
    return current > other ? 'worse-cell' : ''
  }

  const comparison = useMemo(() => {
    const dataA = cityDetailsData[cityA] || cityWeatherData[cityA]
    const dataB = cityDetailsData[cityB] || cityWeatherData[cityB]
    if (!dataA || !dataB) {
      return null
    }

    const currentA = dataA.current
    const currentB = dataB.current
    const aqiA = dataA.airQuality?.aqi_value ?? 100
    const aqiB = dataB.airQuality?.aqi_value ?? 100
    const riskA = dataA.combinedRisk ?? calculateCombinedRisk({ ...currentA, aqi_value: aqiA })
    const riskB = dataB.combinedRisk ?? calculateCombinedRisk({ ...currentB, aqi_value: aqiB })

    const safeHoursA = (dataA.hourly || []).filter((entry) => entry.risk_level <= 4).length * 3
    const safeHoursB = (dataB.hourly || []).filter((entry) => entry.risk_level <= 4).length * 3

    return {
      currentA,
      currentB,
      aqiA,
      aqiB,
      riskA,
      riskB,
      safeHoursA,
      safeHoursB
    }
  }, [cityA, cityB, cityDetailsData, cityWeatherData])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="compare-modal">
        <div className="modal-header">
          <h3>⚖️ Compare Cities</h3>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="compare-controls">
          <select value={cityA} onChange={(event) => setCityA(event.target.value)}>
            {cities.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>

          <select value={cityB} onChange={(event) => setCityB(event.target.value)}>
            {cities.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>

          <button type="button" className="compare-run-btn" onClick={() => setShowResult(true)}>
            Compare
          </button>
        </div>

        {showResult && comparison ? (
          <>
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>{cityA}</th>
                  <th>{cityB}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Temperature</td>
                  <td
                    className={valueClass('temp', comparison.currentA.temp, comparison.currentB.temp)}
                    style={{ color: metricColor(comparison.currentA.temp, 'temp') }}
                  >
                    {comparison.currentA.temp}°C
                  </td>
                  <td
                    className={valueClass('temp', comparison.currentB.temp, comparison.currentA.temp)}
                    style={{ color: metricColor(comparison.currentB.temp, 'temp') }}
                  >
                    {comparison.currentB.temp}°C
                  </td>
                </tr>
                <tr>
                  <td>Feels Like</td>
                  <td
                    className={valueClass('temp', comparison.currentA.feels_like, comparison.currentB.feels_like)}
                    style={{ color: metricColor(comparison.currentA.feels_like, 'temp') }}
                  >
                    {comparison.currentA.feels_like}°C
                  </td>
                  <td
                    className={valueClass('temp', comparison.currentB.feels_like, comparison.currentA.feels_like)}
                    style={{ color: metricColor(comparison.currentB.feels_like, 'temp') }}
                  >
                    {comparison.currentB.feels_like}°C
                  </td>
                </tr>
                <tr>
                  <td>Humidity</td>
                  <td className={valueClass('humidity', comparison.currentA.humidity, comparison.currentB.humidity)}>
                    {comparison.currentA.humidity}%
                  </td>
                  <td className={valueClass('humidity', comparison.currentB.humidity, comparison.currentA.humidity)}>
                    {comparison.currentB.humidity}%
                  </td>
                </tr>
                <tr>
                  <td>AQI</td>
                  <td
                    className={valueClass('aqi', comparison.aqiA, comparison.aqiB)}
                    style={{ color: metricColor(comparison.aqiA, 'aqi') }}
                  >
                    {comparison.aqiA}
                  </td>
                  <td
                    className={valueClass('aqi', comparison.aqiB, comparison.aqiA)}
                    style={{ color: metricColor(comparison.aqiB, 'aqi') }}
                  >
                    {comparison.aqiB}
                  </td>
                </tr>
                <tr>
                  <td>Risk Score</td>
                  <td
                    className={valueClass('risk', comparison.riskA, comparison.riskB)}
                    style={{ color: getRiskBand(comparison.riskA).color }}
                  >
                    {comparison.riskA}
                  </td>
                  <td
                    className={valueClass('risk', comparison.riskB, comparison.riskA)}
                    style={{ color: getRiskBand(comparison.riskB).color }}
                  >
                    {comparison.riskB}
                  </td>
                </tr>
                <tr>
                  <td>Safe Hours</td>
                  <td className={valueClass('safeHours', comparison.safeHoursA, comparison.safeHoursB)}>
                    {comparison.safeHoursA} hrs
                  </td>
                  <td className={valueClass('safeHours', comparison.safeHoursB, comparison.safeHoursA)}>
                    {comparison.safeHoursB} hrs
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="compare-summary">
              {cityA} is {(comparison.currentA.temp - comparison.currentB.temp).toFixed(1)}°C hotter than {cityB}
            </p>
            <p className="compare-summary-hindi">{cityA} का तापमान {cityB} से अधिक है।</p>
          </>
        ) : (
          <p>Select two cities and click Compare.</p>
        )}
      </div>
    </div>
  )
}

export default CompareModal
