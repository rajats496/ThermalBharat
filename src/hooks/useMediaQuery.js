import { useEffect, useState } from 'react'

/**
 * useMediaQuery — returns true when the CSS media query matches.
 * Usage: const isMobile = useMediaQuery('(max-width: 768px)')
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const listener = (e) => setMatches(e.matches)
    setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}
