/**
 * OfflineBanner.jsx — shows a sticky banner when the browser goes offline.
 * Auto-hides when connectivity is restored.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          className="offline-banner"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          role="alert"
          aria-live="assertive"
        >
          📡 You are offline — showing cached data
        </motion.div>
      )}
    </AnimatePresence>
  )
}
