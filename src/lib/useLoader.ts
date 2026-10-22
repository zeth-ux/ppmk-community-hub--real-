import { useCallback, useEffect, useState } from 'react'

import { friendlyError } from './format'

type State<T> = { key: string | null; data: T | null; error: string }

/**
 * Runs an async loader on mount (and whenever `deps` change) and tracks
 * loading / error state. `reload()` re-runs it after a change and resolves
 * when fresh data is in.
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const key = JSON.stringify(deps)
  const [state, setState] = useState<State<T>>({ key: null, data: null, error: '' })

  // `load` is re-created on every render; `key` captures what it depends on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, [key])

  useEffect(() => {
    let cancelled = false

    run().then(
      (data) => {
        if (!cancelled) setState({ key, data, error: '' })
      },
      (err: unknown) => {
        if (!cancelled) setState({ key, data: null, error: friendlyError(err) })
      },
    )

    return () => {
      cancelled = true
    }
  }, [run, key])

  const reload = useCallback(async () => {
    try {
      const data = await run()
      setState({ key, data, error: '' })
    } catch (err) {
      setState((current) => ({ ...current, key, error: friendlyError(err) }))
    }
  }, [run, key])

  const setData = useCallback((data: T | null) => {
    setState((current) => ({ ...current, data }))
  }, [])

  return {
    data: state.data,
    setData,
    loading: state.key !== key,
    error: state.error,
    reload,
  }
}
