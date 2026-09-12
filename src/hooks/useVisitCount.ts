import { useEffect, useState } from 'react'

const COUNTED_KEY = 'fd_visit_counted'

/** Counts each browser session once (via sessionStorage) so repeat page
 * navigations within a visit don't inflate the number. */
export function useVisitCount(): number | null {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const alreadyCounted = sessionStorage.getItem(COUNTED_KEY) === '1'
    const method = alreadyCounted ? 'GET' : 'POST'
    if (!alreadyCounted) {
      try {
        sessionStorage.setItem(COUNTED_KEY, '1')
      } catch {
        /* private browsing, etc. — worst case this tab recounts */
      }
    }
    fetch('/api/visits', { method })
      .then((res) => res.json())
      .then((data: { count: number | null }) => setCount(data.count))
      .catch(() => setCount(null))
  }, [])

  return count
}
