import { apiUrl, fetchDirectory, isDirectoryItems } from './directory'
import { createResourceCache } from '../utils/resourceCache'

// Namespace includes API origin and data format version: never share development
// data with another deployment or deserialize an old incompatible response shape.
export const directoryCache = createResourceCache({
    namespace: `mit-directory:v1:${apiUrl('/api')}`,
    validate: isDirectoryItems,
    storage: () => typeof window === 'undefined' ? undefined : window.localStorage,
    load: resource => fetchDirectory(resource, AbortSignal.timeout(20000)),
})
