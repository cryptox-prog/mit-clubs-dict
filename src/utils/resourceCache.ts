export type CacheSnapshot<T> = {
    data: T | null
    updatedAt: number
    refreshing: boolean
    error: string | null
}
type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Options<T> = {
    namespace: string
    load: (key: string) => Promise<T>
    validate: (value: unknown) => value is T
    storage?: () => StorageAdapter | undefined
    now?: () => number
    freshFor?: number
    retainFor?: number
}
// Only public directory records belong here. Credentials and private user data do not.
export function createResourceCache<T>(options: Options<T>) {
    const now = options.now ?? Date.now
    const freshFor = options.freshFor ?? 5 * 60 * 1000
    const retainFor = options.retainFor ?? 24 * 60 * 60 * 1000
    const entries = new Map<string, CacheSnapshot<T>>()
    const listeners = new Map<string, Set<() => void>>()
    const pending = new Map<string, Promise<T>>()
    const storageKey = (key: string) => `${options.namespace}:${key}`
    function removeStored(key: string) {
        try { options.storage?.()?.removeItem(storageKey(key)) } catch { /* Storage may be blocked. */ }
    }
    function snapshot(key: string): CacheSnapshot<T> {
        const current = entries.get(key)
        if (current && (current.data === null || now() - current.updatedAt <= retainFor)) return current
        // Retired snapshots must not keep old recruitment information indefinitely.
        if (current) { entries.delete(key); removeStored(key) }
        let entry: CacheSnapshot<T> = { data: null, updatedAt: 0, refreshing: false, error: null }
        try {
            const raw = options.storage?.()?.getItem(storageKey(key))
            if (raw) {
                const saved = JSON.parse(raw)
                const age = now() - saved.updatedAt
                if (typeof saved.updatedAt === 'number' && age >= 0 && age <= retainFor && options.validate(saved.data)) {
                    entry = { ...entry, data: saved.data, updatedAt: saved.updatedAt }
                } else removeStored(key)
            }
        } catch { removeStored(key) }
        entries.set(key, entry)
        return entry
    }
    function publish(key: string, entry: CacheSnapshot<T>) {
        entries.set(key, entry)
        listeners.get(key)?.forEach(listener => listener())
    }
    function load(key: string, force = false): Promise<T> {
        const inFlight = pending.get(key)
        if (inFlight) return inFlight
        const saved = snapshot(key)
        if (!force && saved.data !== null && now() - saved.updatedAt < freshFor) return Promise.resolve(saved.data)
        // Begin in a microtask so synchronous loader exceptions and StrictMode's
        // second subscription share this same promise rather than duplicate requests.
        const request = Promise.resolve().then(() => options.load(key))
            .then(data => {
                if (!options.validate(data)) throw new Error('Invalid cached resource')
                const entry = { data, updatedAt: now(), refreshing: false, error: null }
                try { options.storage?.()?.setItem(storageKey(key), JSON.stringify({ data, updatedAt: entry.updatedAt })) } catch { /* In-memory cache still works. */ }
                publish(key, entry)
                return data
            })
            .catch(error => {
                publish(key, { ...snapshot(key), refreshing: false, error: 'Unable to refresh the directory. Check your connection and try again.' })
                throw error
            })
            .finally(() => pending.delete(key))
        pending.set(key, request)
        publish(key, { ...saved, refreshing: true, error: null })
        return request
    }
    return {
        snapshot,
        load,
        subscribe(key: string, listener: () => void) {
            if (!listeners.has(key)) listeners.set(key, new Set())
            listeners.get(key)!.add(listener)
            return () => { listeners.get(key)?.delete(listener) }
        },
    }
}
