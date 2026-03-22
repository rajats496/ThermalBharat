import { useMemo, useState } from 'react'
import { getRiskBand, getRiskLabel } from '../../utils/calculations'
import AlertPanel from './AlertPanel'

const ageMultipliers = {
  under18: 1.2,
  age18to45: 1,
  age45to60: 1.3,
  above60: 1.6
}

const healthMultipliers = {
  none: 1,
  diabetes: 1.3,
  heart: 1.4,
  respiratory: 1.3,
  pregnant: 1.5
}

const jobMultipliers = {
  indoorAc: 0.5,
  indoorNoAc: 0.8,
  outdoor: 1.5,
  construction: 1.6,
  farmer: 1.5
}

function Sidebar({ cities, cityRiskScores, nearestCenterByCity }) {
  const [cityName, setCityName] = useState(cities[0]?.name || '')
  const [ageGroup, setAgeGroup] = useState('age18to45')
  const [health, setHealth] = useState('none')
  const [job, setJob] = useState('indoorNoAc')

  const personalRisk = useMemo(() => {
    const cityRiskScore = cityRiskScores[cityName] ?? 4
    const score = Math.min(
      10,
      cityRiskScore * ageMultipliers[ageGroup] * healthMultipliers[health] * jobMultipliers[job]
    )
    return Number(score.toFixed(1))
  }, [ageGroup, cityName, cityRiskScores, health, job])

  const riskBand = getRiskBand(personalRisk)
  const riskLabel = getRiskLabel(personalRisk)
  const nearestCenter = nearestCenterByCity[cityName]

  let advice = '✅ MODERATE RISK\nTake normal precautions.\nसामान्य सावधानी रखें।'
  if (personalRisk > 7) {
    advice =
      '🚨 EXTREME DANGER\nDo not go outside today.\nIf you must go out:\n→ Only before 8am or after 7pm\n→ Carry minimum 2 liters water\n→ Wear light colored loose clothes\n→ Rest every 30 minutes\n→ Watch for: dizziness, confusion\nबाहर न जाएं। पानी पीते रहें।'
  } else if (personalRisk >= 4) {
    advice = '⚠️ HIGH RISK\nLimit outdoor time.\nAvoid 11am - 4pm outdoors.\nसावधान रहें।'
  }

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <h2>🧑 Personal Risk Calculator</h2>
      <p className="sidebar-subtitle">व्यक्तिगत जोखिम कैलकुलेटर</p>

      <div className="control-block">
        <label>Your City</label>
        <select value={cityName} onChange={(event) => setCityName(event.target.value)}>
          {cities.map((city) => (
            <option key={city.name} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      <div className="control-block">
        <label>Age group</label>
        <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)}>
          <option value="under18">Under 18</option>
          <option value="age18to45">18-45</option>
          <option value="age45to60">45-60</option>
          <option value="above60">Above 60</option>
        </select>
      </div>

      <div className="control-block">
        <label>Health condition</label>
        <select value={health} onChange={(event) => setHealth(event.target.value)}>
          <option value="none">None</option>
          <option value="diabetes">Diabetes</option>
          <option value="heart">Heart condition</option>
          <option value="respiratory">Respiratory</option>
          <option value="pregnant">Pregnant</option>
        </select>
      </div>

      <div className="control-block">
        <label>Job type</label>
        <select value={job} onChange={(event) => setJob(event.target.value)}>
          <option value="indoorAc">Indoor with AC</option>
          <option value="indoorNoAc">Indoor without AC</option>
          <option value="outdoor">Outdoor worker</option>
          <option value="construction">Construction</option>
          <option value="farmer">Farmer</option>
        </select>
      </div>

      <div className="personal-score-card" style={{ borderColor: riskBand.color }}>
        <div className="score-number" style={{ color: riskBand.color }}>
          {personalRisk}
        </div>
        <p>
          {riskLabel.label} | {riskLabel.labelHindi}
        </p>
      </div>

      <pre className="advice-block">{advice}</pre>

      <div className="sidebar-note">
        <strong>Nearest cooling center:</strong>
        <p>{nearestCenter ? nearestCenter.name : 'Not available'}</p>
        <p className="emergency">Emergency number: 108</p>
      </div>

      {/* Part 6 — Heatwave alert registration + history */}
      <AlertPanel />
    </aside>
  )
}

export default Sidebar

