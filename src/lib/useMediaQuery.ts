import { useEffect, useState } from 'react'

/** Reactive `matchMedia`. Used by the Calendar View to pick grid vs agenda. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (!('matchMedia' in window)) return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export function useIsNarrow(maxWidthPx = 640): boolean {
  return useMediaQuery(`(max-width: ${maxWidthPx}px)`)
}
