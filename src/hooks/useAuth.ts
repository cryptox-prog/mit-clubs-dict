import { useEffect, useSyncExternalStore } from 'react'
import { authStore, refreshSession } from '../api/auth'

export function useAuth() {
    const auth = useSyncExternalStore(authStore.subscribe, authStore.snapshot)
    useEffect(() => {
        authStore.bootstrap()
        const reconnect = () => { if (authStore.snapshot().unavailable) void refreshSession().catch(() => {}) }
        window.addEventListener('online', reconnect)
        return () => window.removeEventListener('online', reconnect)
    }, [])
    return auth
}
