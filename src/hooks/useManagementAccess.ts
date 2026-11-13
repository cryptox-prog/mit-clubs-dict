import { useEffect, useState } from 'react'
import { managementRequest } from '../api/management'
import type { ManagementAccess } from '../api/management'

export function useManagementAccess(userId: string | undefined, enabled: boolean) {
    const [result, setResult] = useState<{ userId: string; access: ManagementAccess } | null>(null)
    useEffect(() => {
        if (!userId || !enabled) return
        const controller = new AbortController()
        managementRequest<ManagementAccess>('/access', { signal: controller.signal })
            .then(access => setResult({ userId, access }))
            .catch(() => { if (!controller.signal.aborted) setResult(null) })
        return () => controller.abort()
    }, [userId, enabled])
    return result?.userId === userId ? result?.access : null
}
