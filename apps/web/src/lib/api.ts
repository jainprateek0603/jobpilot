export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string[]>

  constructor(message: string, status: number, code: string, fields?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

let accessToken: string | null = null
let refreshPromise: Promise<boolean> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(path, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register') && path !== '/api/auth/refresh') {
    const refreshed = await refreshAccess()
    if (refreshed) return api<T>(path, options, false)
  }
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('text/csv')) {
    if (!response.ok) throw new ApiError('Export failed', response.status, 'EXPORT')
    return (await response.text()) as T
  }
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string; code?: string; fields?: Record<string, string[]> } } | null
  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? 'Request failed', response.status, payload?.error?.code ?? 'ERROR', payload?.error?.fields)
  }
  return payload?.data as T
}

async function refreshAccess() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          accessToken = null
          return false
        }
        const payload = (await response.json()) as { data?: { accessToken?: string } }
        accessToken = payload.data?.accessToken ?? null
        return Boolean(accessToken)
      })
      .catch(() => {
        accessToken = null
        return false
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}
