/**
 * HeatwaveBanner.jsx — ThermalBharat Part 8A
 * ============================================
 * Animated scrolling ticker banner above navbar.
 * Red background, white text, auto-scrolls left.
 * Dismissible with X button.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HeatwaveBanner({ alerts = [], dismissed = [], onDismiss }) {
  const visible = alerts.filter(a => !dismissed.includes(a.cityName))
  const [dismissed2, setDismissed2] = useState(false)   // dismiss whole ticker

  if (!visible.length || dismissed2) return null

  // Build the ticker text by repeating city alerts
  const ticker = visible
    .map(a => `⚠️ हीटवेव चेतावनी — ${a.cityName} ${Math.round(a.temp)}°C अगले ${a.days} दिन`)
    .join('   •   ')

  // Duplicate for seamless loop
  const full = `${ticker}   •   ${ticker}`

  return (
    <AnimatePresence>
      <motion.div
        className="hwave-root"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 36, opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="hwave-ticker-wrap">
          <div className="hwave-label">🚨 ALERT</div>
          <div className="hwave-ticker-track">
            <span className="hwave-ticker-text">{full}</span>
          </div>
        </div>
        <button
          type="button"
          className="hwave-dismiss"
          onClick={() => setDismissed2(true)}
          aria-label="Dismiss heatwave banner"
        >
          ✕
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
