/**
 * MethodologyModal.jsx — ThermalBharat Part 7, Feature 4
 * =========================================================
 * Full-screen modal explaining data sources, ML models,
 * calculations, research papers, and limitations.
 */

import { useEffect } from 'react'

export default function MethodologyModal({ onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box methodology-modal">
        {/* Header */}
        <div className="meth-header">
          <div>
            <h2>📖 How ThermalBharat Works</h2>
            <p className="hindi-text">ThermalBharat कैसे काम करता है</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="meth-body">

          {/* Section 1 — Data Sources */}
          <section className="meth-section">
            <h3>🛰️ Data Sources <span className="hindi-text">— डेटा स्रोत</span></h3>

            <div className="meth-source-grid">
              <div className="meth-source-card">
                <div className="meth-source-icon">🛰️</div>
                <div>
                  <div className="meth-source-name">Yale/YCEO UHI Dataset</div>
                  <code className="meth-code">YALE/YCEO/UHI/UHI_yearly_pixel/v4</code>
                  <ul className="meth-list">
                    <li>300m resolution</li>
                    <li>2003–2018 (16 years)</li>
                    <li>Urban heat island intensity</li>
                  </ul>
                  <a className="meth-link" href="https://developers.google.com/earth-engine" target="_blank" rel="noreferrer">
                    developers.google.com/earth-engine ↗
                  </a>
                </div>
              </div>

              <div className="meth-source-card">
                <div className="meth-source-icon">🌿</div>
                <div>
                  <div className="meth-source-name">Sentinel-2 ESA</div>
                  <code className="meth-code">COPERNICUS/S2_SR_HARMONIZED</code>
                  <ul className="meth-list">
                    <li>NDVI vegetation index</li>
                    <li>10m resolution</li>
                    <li>Updated every 5 days</li>
                  </ul>
                  <a className="meth-link" href="https://sentinel.esa.int" target="_blank" rel="noreferrer">
                    sentinel.esa.int ↗
                  </a>
                </div>
              </div>

              <div className="meth-source-card">
                <div className="meth-source-icon">🌲</div>
                <div>
                  <div className="meth-source-name">Hansen Global Forest Watch</div>
                  <code className="meth-code">UMD/hansen/global_forest_change_2022</code>
                  <ul className="meth-list">
                    <li>Tree cover percentage</li>
                    <li>30m resolution</li>
                  </ul>
                  <a className="meth-link" href="https://globalforestwatch.org" target="_blank" rel="noreferrer">
                    globalforestwatch.org ↗
                  </a>
                </div>
              </div>

              <div className="meth-source-card">
                <div className="meth-source-icon">🌡️</div>
                <div>
                  <div className="meth-source-name">OpenWeatherMap API</div>
                  <ul className="meth-list">
                    <li>Live temperature, humidity, AQI</li>
                    <li>30 Indian cities</li>
                    <li>Updated hourly</li>
                  </ul>
                  <a className="meth-link" href="https://openweathermap.org" target="_blank" rel="noreferrer">
                    openweathermap.org ↗
                  </a>
                </div>
              </div>

              <div className="meth-source-card">
                <div className="meth-source-icon">📡</div>
                <div>
                  <div className="meth-source-name">Open-Meteo ERA5</div>
                  <ul className="meth-list">
                    <li>Historical temperature 2018–2024</li>
                    <li>Free reanalysis data</li>
                    <li>Corrected using IMD baselines</li>
                  </ul>
                  <a className="meth-link" href="https://open-meteo.com" target="_blank" rel="noreferrer">
                    open-meteo.com ↗
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2 — ML Models */}
          <section className="meth-section">
            <h3>🤖 ML Models <span className="hindi-text">— मशीन लर्निंग</span></h3>

            <div className="meth-algo-grid">
              <div className="meth-algo-card">
                <div className="meth-algo-title">🔵 K-Means Clustering</div>
                <p>We grouped all 30 cities into <strong>4 heat zones</strong> using live weather data.</p>
                <ul className="meth-list">
                  <li><strong>Algorithm:</strong> Custom K-Means from scratch (no external ML lib)</li>
                  <li><strong>Features:</strong> Temperature, Humidity, AQI, Risk Score</li>
                  <li><strong>Result:</strong> Cool / Moderate / Hot / Extreme zones</li>
                </ul>
              </div>

              <div className="meth-algo-card">
                <div className="meth-algo-title">📈 Linear Regression (2030 Prediction)</div>
                <p>We predict 2030 temperatures using <strong>22 years</strong> of combined satellite + reanalysis data.</p>
                <ul className="meth-list">
                  <li><strong>Yale satellite (2003–2018):</strong> 70% weight</li>
                  <li><strong>Open-Meteo (2018–2024):</strong> 30% weight</li>
                  <li><strong>Slope clamped:</strong> +0.02 to +0.08°C/year (IPCC bounds)</li>
                  <li><strong>Algorithm:</strong> OLS regression from scratch</li>
                  <li><strong>Validated:</strong> Against IPCC AR6 South Asia projections</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 — Calculations */}
          <section className="meth-section">
            <h3>🔢 Calculations <span className="hindi-text">— गणना पद्धति</span></h3>

            <div className="meth-calc-grid">
              <div className="meth-calc-card">
                <div className="meth-calc-icon">🌳</div>
                <div className="meth-calc-title">Trees Needed Formula</div>
                <code className="meth-formula">
                  Gap = Target NDVI (0.30) − Current NDVI<br />
                  Trees = Gap × Plantable Area ÷ 20 m²<br />
                  Plantable area = 15% of urban pixel
                </code>
                <p className="meth-source-note">Based on urban planning standards & WHO guidelines</p>
              </div>

              <div className="meth-calc-card">
                <div className="meth-calc-icon">❄️</div>
                <div className="meth-calc-title">Cooling Effect</div>
                <code className="meth-formula">
                  Cooling = Trees × 0.05°C per tree<br />
                  Capped at 5°C maximum
                </code>
                <p className="meth-source-note">Based on WHO Urban Forestry Research (Bowler et al., 2010)</p>
              </div>

              <div className="meth-calc-card">
                <div className="meth-calc-icon">💡</div>
                <div className="meth-calc-title">Electricity Savings</div>
                <code className="meth-formula">
                  1°C cooling = 2% electricity reduction<br />
                  Avg bill = ₹800/month per household
                </code>
                <p className="meth-source-note">Based on Bureau of Energy Efficiency (BEE), India</p>
              </div>
            </div>
          </section>

          {/* Section 4 — Research Papers */}
          <section className="meth-section">
            <h3>📚 Research Papers <span className="hindi-text">— शोध पत्र</span></h3>
            <div className="meth-papers">
              {[
                { title: 'Global surface UHI factors', authors: 'Chakraborty & Lee, 2019', journal: 'Nature Communications', href: 'https://www.nature.com/articles/s41467-019-12347-1' },
                { title: 'Trees and urban cooling', authors: 'Bowler et al., 2010', journal: 'Landscape and Urban Planning', href: 'https://doi.org/10.1016/j.landurbplan.2010.01.005' },
                { title: 'Heat and health in India', authors: 'WHO South-East Asia, 2022', journal: 'WHO Report', href: 'https://www.who.int/southeastasia/health-topics/heat' },
                { title: 'IPCC AR6 South Asia', authors: 'IPCC, 2021', journal: 'IPCC Sixth Assessment Report', href: 'https://www.ipcc.ch/report/ar6/wg1/' },
              ].map((p) => (
                <a key={p.title} className="meth-paper-card" href={p.href} target="_blank" rel="noreferrer">
                  <div className="meth-paper-title">{p.title}</div>
                  <div className="meth-paper-meta">{p.authors} — <em>{p.journal}</em></div>
                </a>
              ))}
            </div>
          </section>

          {/* Section 5 — Limitations */}
          <section className="meth-section">
            <h3>⚠️ Limitations <span className="hindi-text">— सीमाएं</span></h3>
            <div className="meth-limits">
              <div className="meth-limit-item">📅 Satellite data ends at 2018 (Yale YCEO)</div>
              <div className="meth-limit-item">🌡️ ERA5 underestimates real temperature by 5–7°C — corrected using IMD baselines</div>
              <div className="meth-limit-item">🌳 Tree calculations are estimates based on average urban geometry</div>
              <div className="meth-limit-item">📈 2030 predictions assume linear warming trend</div>
              <div className="meth-limit-item">🌐 OpenWeatherMap data accuracy varies for smaller cities</div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
