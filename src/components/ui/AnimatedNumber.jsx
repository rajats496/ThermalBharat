import { useEffect, useState } from 'react'

/**
 * AnimatedNumber — count-up animation for any numeric value.
 * Usage: <AnimatedNumber value={38.5} decimals={1} />°C
 */
export default function AnimatedNumber({ value, duration = 1200, decimals = 0 }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const end = parseFloat(value)
    if (isNaN(end)) return
    let startTime = null

    const step = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(parseFloat((eased * end).toFixed(decimals)))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, duration, decimals])

  return <span>{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}</span>
}
