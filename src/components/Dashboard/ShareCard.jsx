/**
 * ShareCard.jsx — ThermalBharat Part 7, Feature 3
 * =================================================
 * Generates a branded shareable card with city heat data.
 * Downloads as PNG (html2canvas) or copies URL to clipboard.
 */

import html2canvas from 'html2canvas'
import { useRef, useState } from 'react'

export default function ShareCard({ city, currentWeather, riskScore, suhi, treesNeeded, pred2030 }) {
  const cardRef  = useRef(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [open,   setOpen]  = useState(false)

  const temp      = currentWeather?.temp        ?? '—'
  const humidity  = currentWeather?.humidity    ?? '—'
  const riskLabel = riskScore >= 8 ? 'EXTREME 🔴' : riskScore >= 6 ? 'HIGH 🟠' : riskScore >= 4 ? 'MODERATE 🟡' : 'LOW 🟢'

  // Format trees as lakh / crore
  function fmtTrees(n) {
    if (n === null || n === undefined) return '—'
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} cr`
    if (n >= 100_000)    return `${(n / 100_000).toFixed(1)}L`
    return n.toLocaleString('en-IN')
  }

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f1117',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const link    = document.createElement('a')
      link.download = `ThermalBharat_${city?.name?.replace(/\s/g, '_')}_Heat.png`
      link.href     = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Screenshot error:', err)
    }
    setDownloading(false)
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?city=${encodeURIComponent(city?.name || '')}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (!city) return null

  return (
    <div className="detail-card">
      <h4>
        📤 Share Heat Data
        <span className="hindi-text"> — डेटा शेयर करें</span>
      </h4>

      <div className="share-btn-row">
        <button className="share-action-btn" onClick={() => setOpen(v => !v)}>
          {open ? '🙈 Hide Card' : '👁️ Preview Card'}
        </button>
        <button className="share-action-btn download" onClick={handleDownload} disabled={downloading}>
          {downloading ? '⏳ Saving...' : '⬇️ Download PNG'}
        </button>
        <button className="share-action-btn copy" onClick={handleCopyLink}>
          {copied ? '✅ Link Copied!' : '🔗 Copy Link'}
        </button>
      </div>

      {/* The shareable card (always rendered for html2canvas, hidden when not previewing) */}
      <div style={{ overflow: 'hidden', height: open ? 'auto' : 0, transition: 'height 0.3s', marginTop: open ? 12 : 0 }}>
        <div ref={cardRef} className="share-card-face">
          {/* Header */}
          <div className="sc-header">
            <span className="sc-logo">🌡️ ThermalBharat</span>
            <span className="sc-tagline">India Urban Heat Island Mapper</span>
          </div>

          {/* City */}
          <div className="sc-city">
            <div className="sc-city-name">{city.name}</div>
            <div className="sc-city-hindi hindi-text">{city.nameHindi}</div>
          </div>

          {/* Stats grid */}
            <div className="sc-stats">
              <div className="sc-stat">
                <div className="sc-stat-val" style={{ color: '#ff4444' }}>{temp}°C</div>
                <div className="sc-stat-label">Live Temp</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat-val" style={{ fontSize: 13 }}>{riskLabel}</div>
                <div className="sc-stat-label">Heat Risk</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat-val" style={{ color: '#fd8d3c' }}>
                  {suhi !== null && suhi !== undefined ? `${suhi}°C` : '…'}
                </div>
                <div className="sc-stat-label">SUHI Intensity</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat-val" style={{ color: '#00cc88' }}>
                  {fmtTrees(treesNeeded)}
                </div>
                <div className="sc-stat-label">Trees Needed</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat-val" style={{ color: '#ffaa00' }}>
                  {pred2030 !== null && pred2030 !== undefined ? `${pred2030}°C` : '…'}
                </div>
                <div className="sc-stat-label">2030 Prediction</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat-val">{humidity}%</div>
                <div className="sc-stat-label">Humidity</div>
              </div>
            </div>

          {/* Footer */}
          <div className="sc-footer">
            <span>Source: ThermalBharat.in</span>
            <span>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
