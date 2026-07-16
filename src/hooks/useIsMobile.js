import { useEffect, useState } from 'react'

// Matches the app's own mobile breakpoint — sidebar goes off-canvas below
// this width (see the @media (max-width: 880px) block in style.css).
const MOBILE_BREAKPOINT = 880

// True once the viewport is at or below the app's mobile breakpoint. Used to
// reorder table columns (Actions first) without touching desktop layout.
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const handler = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
