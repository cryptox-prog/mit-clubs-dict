import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { directoryCache } from '../api/directoryCache'

export function useDirectory(resource: string) {
    const subscribe = useCallback((listener: () => void) => directoryCache.subscribe(resource, listener), [resource])
    const getSnapshot = useCallback(() => directoryCache.snapshot(resource), [resource])
    const snapshot = useSyncExternalStore(subscribe, getSnapshot)
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState !== 'hidden') void directoryCache.load(resource).catch(() => {})
        }
        refresh()
        window.addEventListener('focus', refresh)
        window.addEventListener('online', refresh)
        document.addEventListener('visibilitychange', refresh)
        const timer = window.setInterval(refresh, 60000)
        return () => {
            window.clearInterval(timer)
            window.removeEventListener('focus', refresh)
            window.removeEventListener('online', refresh)
            document.removeEventListener('visibilitychange', refresh)
        }
    }, [resource])
    const hasData = snapshot.data !== null
    return {
        items: snapshot.data ?? [],
        loading: !hasData && !snapshot.error,
        error: hasData ? null : snapshot.error,
        warning: hasData ? snapshot.error : null,
        retry: () => { void directoryCache.load(resource, true).catch(() => {}) },
    }
}
