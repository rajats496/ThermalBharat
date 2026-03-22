/**
 * MethodologyPage.jsx — Part 8C, Page 3 (enhanced)
 * ==================================================
 * Research-paper style layout with sticky sidebar TOC
 * and scrollable content at /methodology
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const SECTIONS = [
  { id: 'overview',   label: '📋 Overview' },
  { id: 'data',       label: '🛰️ Data Sources' },
  { id: 'ml',         label: '🤖 ML Models' },
  { id: 'calc',       label: '🔢 Calculations' },
  { id: 'papers',     label: '📚 Research Papers' },
  { id: 'limits',     label: '⚠️ Limitations' },
]

function useActiveSection(sectionIds) {
  const [active, setActive] = useState(sectionIds[0])
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) })
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )
    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])
  return active
}

export default function MethodologyPage() {
  const navigate = useNavigate()
  const active   = useActiveSection(SECTIONS.map(s => s.id))

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mp-root">
      {/* Back button */}
      <button className="cdp-back-btn mp-back" onClick={() => navigate(-1)}>← Back</button>

      <div className="mp-layout">
        {/* ── Sticky left sidebar ─────────────────────────────── */}
        <aside className="mp-sidebar">
          <div className="mp-sidebar-title">📖 Contents</div>
          <nav className="mp-toc">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`mp-toc-item ${active === s.id ? 'active' : ''}`}
                onClick={() => scrollTo(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className="mp-sidebar-badge">
            <div style={{ fontSize: 11, color: '#666' }}>Built with</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              Yale YCEO · Sentinel-2<br />ERA5 · OWM API
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────── */}
        <main className="mp-content">

          {/* SECTION 1 — Overview */}
          <section id="overview" className="mp-section">
            <h2 className="mp-section-title">📋 Overview</h2>
            <p className="mp-text">
              ThermalBharat maps the <strong>Urban Heat Island (UHI)</strong> effect across India's 30 largest cities
              using a combination of satellite remote sensing, meteorological reanalysis, and machine learning.
            </p>
            <p className="mp-text">
              Urban Heat Islands form when concrete and asphalt replace natural vegetation, trapping heat
              and raising city temperatures 2–8°C above surrounding rural areas. This causes increased
              energy demand, heat-related illness, and deteriorating air quality.
            </p>
            <div className="mp-callout">
              <strong>Mission:</strong> Make satellite climate science accessible to every citizen and policymaker in India.
              <span className="hindi-text"> — भारत के हर नागरिक तक जलवायु विज्ञान पहुँचाना</span>
            </div>
          </section>

          {/* SECTION 2 — Data Sources */}
          <section id="data" className="mp-section">
            <h2 className="mp-section-title">🛰️ Data Sources</h2>
            {[
              {
                icon: '🛰️', name: 'Yale YCEO UHI Dataset',
                code: 'YALE/YCEO/UHI/UHI_yearly_pixel/v4',
                desc: 'The primary source for Urban Heat Island intensity. Provides per-pixel SUHI values at 300m resolution from 2003 to 2018, derived from MODIS/Terra land surface temperature data.',
                items: ['300m spatial resolution', '2003–2018 (16 years)', 'Day & night measurements', 'Relative to rural baseline'],
                href: 'https://developers.google.com/earth-engine', link: 'earth-engine docs ↗',
              },
              {
                icon: '🌿', name: 'Sentinel-2 ESA',
                code: 'COPERNICUS/S2_SR_HARMONIZED',
                desc: 'Used to calculate NDVI (Normalized Difference Vegetation Index) — a measure of green cover density. Higher NDVI means more trees and lower urban heat.',
                items: ['10m spatial resolution', 'Updated every 5 days', 'NDVI range: −1 (water) to +1 (dense forest)', 'Used for tree planting calculations'],
                href: 'https://sentinel.esa.int', link: 'sentinel.esa.int ↗',
              },
              {
                icon: '🌲', name: 'Hansen Global Forest Watch',
                code: 'UMD/hansen/global_forest_change_2022',
                desc: 'Provides 30m resolution tree cover data to identify vegetated vs urban pixels, used in filtering water bodies and agricultural land from NDVI calculations.',
                items: ['30m resolution', 'Annual forest change', 'Used as land mask'],
                href: 'https://globalforestwatch.org', link: 'globalforestwatch.org ↗',
              },
              {
                icon: '🌡️', name: 'OpenWeatherMap API', code: null,
                desc: 'Provides real-time weather data for all 30 cities: temperature, humidity, wind, air quality index, and 5-day hourly forecasts.',
                items: ['Updated hourly', 'Coverage: 30 Indian cities', 'Includes AQI (PM2.5, PM10, NO₂, O₃)', 'Used for risk score calculation'],
                href: 'https://openweathermap.org', link: 'openweathermap.org ↗',
              },
              {
                icon: '📡', name: 'Open-Meteo ERA5 (ECMWF)', code: null,
                desc: 'Historical reanalysis data from 2018–2024. Used to calculate recent warming trends (slope) and bridge the gap between SUHI satellite data (ends 2018) and present day.',
                items: ['2018–2024 temperature histography', 'April–June summer average', 'Corrected +5–7°C using IMD India baselines', 'Used for 2030 linear regression'],
                href: 'https://open-meteo.com', link: 'open-meteo.com ↗',
              },
            ].map(s => (
              <motion.div key={s.name} className="mp-source-card"
                initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.4 }}>
                <div className="mp-source-header">
                  <span className="mp-source-icon">{s.icon}</span>
                  <div>
                    <div className="mp-source-name">{s.name}</div>
                    {s.code && <code className="mp-code-inline">{s.code}</code>}
                  </div>
                </div>
                <p className="mp-text">{s.desc}</p>
                <ul className="mp-list">{s.items.map(i => <li key={i}>{i}</li>)}</ul>
                <a href={s.href} target="_blank" rel="noreferrer" className="mp-ext-link">{s.link}</a>
              </motion.div>
            ))}
          </section>

          {/* SECTION 3 — ML Models */}
          <section id="ml" className="mp-section">
            <h2 className="mp-section-title">🤖 ML Models</h2>

            <div className="mp-algo-card">
              <div className="mp-algo-title">🔵 K-Means Clustering — Heat Zone Classification</div>
              <p className="mp-text">All 30 cities are grouped into 4 heat zones using live weather data every session.</p>
              <pre className="mp-code-block">{`// Custom K-Means from scratch (no external ML library)
Features: [temperature, humidity, aqi, riskScore]
K = 4 clusters
Result:
  Cluster 0 → Cool Zone     (temp < 32°C)
  Cluster 1 → Moderate Zone (temp 32–38°C)
  Cluster 2 → Hot Zone      (temp 38–43°C)
  Cluster 3 → Extreme Zone  (temp > 43°C)`}</pre>
            </div>

            <div className="mp-algo-card">
              <div className="mp-algo-title">📈 Linear Regression — 2030 Temperature Prediction</div>
              <p className="mp-text">
                Uses 22 years of combined satellite + ERA5 data to predict summer temperatures by 2030.
              </p>
              <pre className="mp-code-block">{`// OLS Regression from scratch
Data sources:
  Yale SUHI 2003-2018  → slope_suhi  (weight: 70%)
  ERA5 2018-2024       → slope_era5  (weight: 30%)

combined_slope = 0.7 * slope_suhi + 0.3 * slope_era5

// IPCC AR6 bounds enforcement:
slope = clamp(slope, +0.02, +0.08)  // °C/year

pred_2030 = baseline + combined_slope * (2030 - anchor_year)

// Validated against IPCC AR6 South Asia projections`}</pre>
            </div>

            <div className="mp-algo-card">
              <div className="mp-algo-title">🏘️ NDVI-Based Neighborhood Analysis</div>
              <p className="mp-text">
                For cities with GEE data, NDVI pixels are sorted to identify the greenest (affluent) and
                least green (dense urban) neighborhoods, enabling heat inequality analysis.
              </p>
              <pre className="mp-code-block">{`// Filter valid urban pixels
urbanPixels = ndvi.filter(p => p.ndvi >= 0.05 && p.ndvi <= 0.70)

richPixel = max(urbanPixels, key=ndvi)   // Most green
poorPixel = min(urbanPixels, key=ndvi)   // Least green

// Match to nearest GEE SUHI pixel for real temperature`}</pre>
            </div>
          </section>

          {/* SECTION 4 — Calculations */}
          <section id="calc" className="mp-section">
            <h2 className="mp-section-title">🔢 Calculations</h2>
            {[
              {
                icon: '🌳', title: 'Trees Needed',
                formula: `gap = 0.30 - current_ndvi        // Target NDVI = 0.30 (WHO standard)
plantable_area = pixel_area * 0.15    // 15% of urban pixel is plantable
trees_per_pixel = (gap * plantable_area) / 20  // 20m² per tree
total_trees = sum(trees_per_pixel) for all city pixels`,
                note: 'Based on urban planning standards & WHO Urban Green Space guidelines',
              },
              {
                icon: '❄️', title: 'Cooling Effect',
                formula: `cooling = trees * 0.05           // 0.05°C per tree
cooling = min(cooling, 5.0)           // Maximum 5°C cooling cap`,
                note: 'Based on WHO Urban Forestry Research (Bowler et al., 2010)',
              },
              {
                icon: '💡', title: 'Electricity Savings',
                formula: `households = city_population / 4.5      // Avg household size
cooling_pct = cooling_degC * 0.02         // 2% reduction per °C
monthly_saving = households * 800 * cooling_pct  // ₹800 avg bill`,
                note: 'Based on Bureau of Energy Efficiency (BEE), Government of India',
              },
              {
                icon: '⚠️', title: 'Combined Risk Score',
                formula: `risk = (temp_score * 0.4) +
        (aqi_score  * 0.3) +
        (humidity_score * 0.2) +
        (feels_like_score * 0.1)

// Normalized 0–10 scale
// ≥8: Extreme | 6–8: High | 4–6: Moderate | <4: Low`,
                note: 'Custom formula based on IMD heat action plan thresholds',
              },
            ].map(c => (
              <div key={c.title} className="mp-calc-card">
                <div className="mp-calc-header">
                  <span>{c.icon}</span>
                  <span className="mp-calc-title">{c.title}</span>
                </div>
                <pre className="mp-code-block">{c.formula}</pre>
                <p className="mp-source-note">{c.note}</p>
              </div>
            ))}
          </section>

          {/* SECTION 5 — Research Papers */}
          <section id="papers" className="mp-section">
            <h2 className="mp-section-title">📚 Research Papers</h2>
            <div className="mp-papers-grid">
              {[
                { title: 'Global surface UHI factors', authors: 'Chakraborty & Lee, 2019', journal: 'Nature Communications', href: 'https://www.nature.com/articles/s41467-019-12347-1', desc: 'Established the global dataset (Yale YCEO) used for our SUHI baseline.' },
                { title: 'Trees and urban cooling', authors: 'Bowler et al., 2010', journal: 'Landscape and Urban Planning', href: 'https://doi.org/10.1016/j.landurbplan.2010.01.005', desc: 'Source for the 0.05°C/tree cooling coefficient used in our calculator.' },
                { title: 'Heat and health in India', authors: 'WHO South-East Asia, 2022', journal: 'WHO Report', href: 'https://www.who.int/southeastasia/health-topics/heat', desc: 'Basis for heat stroke risk thresholds and safe hour recommendations.' },
                { title: 'IPCC AR6 South Asia projections', authors: 'IPCC, 2021', journal: 'IPCC Sixth Assessment Report', href: 'https://www.ipcc.ch/report/ar6/wg1/', desc: 'Used to validate and bound our 2030 temperature predictions.' },
              ].map(p => (
                <a key={p.title} className="mp-paper-card" href={p.href} target="_blank" rel="noreferrer">
                  <div className="mp-paper-title">{p.title}</div>
                  <div className="mp-paper-authors">{p.authors}</div>
                  <div className="mp-paper-journal"><em>{p.journal}</em></div>
                  <div className="mp-paper-desc">{p.desc}</div>
                </a>
              ))}
            </div>
          </section>

          {/* SECTION 6 — Limitations */}
          <section id="limits" className="mp-section">
            <h2 className="mp-section-title">⚠️ Limitations</h2>
            <p className="mp-text">We are transparent about the following data gaps and assumptions:</p>
            {[
              { icon: '📅', text: 'Satellite SUHI data ends at 2018 (Yale YCEO v4). No updated dataset is currently publicly available.' },
              { icon: '🌡️', text: 'ERA5 reanalysis underestimates actual Indian summer temperatures by 5–7°C. We apply IMD historical corrections to normalize.' },
              { icon: '🌳', text: 'Tree planting calculations assume uniform 20m² per tree and 15% plantable area — actual values vary by locality.' },
              { icon: '📈', text: '2030 predictions assume a continued linear warming trend. Non-linear climate feedbacks could change these estimates.' },
              { icon: '🌐', text: 'OpenWeatherMap accuracy varies for smaller cities and during extreme weather events.' },
              { icon: '🏘️', text: 'Neighborhood heat inequality uses nearest-pixel approximation, not actual street-level measurements.' },
            ].map(l => (
              <div key={l.icon} className="mp-limit-item">
                <span className="mp-limit-icon">{l.icon}</span>
                <span>{l.text}</span>
              </div>
            ))}
            <div className="mp-callout" style={{ marginTop: 20 }}>
              Despite these limitations, ThermalBharat provides the most comprehensive publicly available
              urban heat analysis for Indian cities — openly accessible to all.
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}
