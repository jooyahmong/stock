import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Repository } from './types'

const RepositoryContext = createContext<Repository | null>(null)

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: Repository
  children: ReactNode
}) {
  return (
    <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>
  )
}

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext)
  if (!repo) throw new Error('useRepository must be used inside <RepositoryProvider>')
  return repo
}

/**
 * Backend-agnostic reactive query. Re-runs `run(repo)` on mount, when `deps`
 * change, and whenever the repository emits a change event. Works identically
 * whether the repository is Dexie or a future D1/HTTP implementation.
 */
export function useRepoQuery<T>(
  run: (repo: Repository) => Promise<T>,
  deps: unknown[],
): { data: T | undefined; loading: boolean; error: unknown } {
  const repo = useRepository()
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    let cancelled = false
    const execute = () => {
      setLoading(true)
      runRef
        .current(repo)
        .then((result) => {
          if (!cancelled) {
            setData(result)
            setError(null)
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    execute()
    const unsubscribe = repo.subscribe(execute)
    return () => {
      cancelled = true
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, ...deps])

  return { data, loading, error }
}
