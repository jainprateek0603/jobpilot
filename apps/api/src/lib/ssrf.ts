import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { AppError } from './errors.js'

export type LookupFn = (host: string) => Promise<{ address: string }[]>

export async function defaultLookup(host: string): Promise<{ address: string }[]> {
  const records = await lookup(host, { all: true })
  return records.map((record) => ({ address: record.address }))
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice('::ffff:'.length))
  const version = net.isIP(normalized)
  if (version === 6) {
    if (normalized === '::1' || normalized === '::') return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    return normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')
  }
  if (version !== 4) return true
  const parts = normalized.split('.').map((part) => Number(part))
  const a = parts[0] ?? -1
  const b = parts[1] ?? -1
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

export async function assertPublicHttpUrl(raw: string, lookupFn: LookupFn = defaultLookup): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new AppError(400, 'VALIDATION', 'Enter a valid http(s) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(400, 'VALIDATION', 'Enter a valid http(s) URL')
  }
  if (url.username || url.password) {
    throw new AppError(400, 'VALIDATION', 'Links with credentials are not allowed')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === 'metadata.google.internal'
  ) {
    throw new AppError(400, 'VALIDATION', 'That link cannot be read')
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new AppError(400, 'VALIDATION', 'That link cannot be read')
    return url
  }
  let records: { address: string }[]
  try {
    records = await lookupFn(host)
  } catch {
    throw new AppError(422, 'LINK_UNREADABLE', 'That link could not be resolved')
  }
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new AppError(400, 'VALIDATION', 'That link cannot be read')
  }
  return url
}

const MAX_BYTES = 500_000

export async function fetchPublicHtml(
  rawUrl: string,
  deps: { fetchFn?: typeof fetch; lookupFn?: LookupFn } = {},
): Promise<string> {
  const fetchFn = deps.fetchFn ?? fetch
  const lookupFn = deps.lookupFn ?? defaultLookup
  let current = await assertPublicHttpUrl(rawUrl, lookupFn)
  for (let hop = 0; hop < 3; hop += 1) {
    const response = await fetchFn(current.toString(), {
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'JobPilotLinkParser/1.0',
      },
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new AppError(422, 'LINK_UNREADABLE', 'That link did not return a page')
      current = await assertPublicHttpUrl(new URL(location, current).toString(), lookupFn)
      continue
    }
    if (!response.ok) throw new AppError(422, 'LINK_UNREADABLE', 'That link could not be read')
    const advertised = Number(response.headers.get('content-length') ?? '0')
    if (Number.isFinite(advertised) && advertised > MAX_BYTES) {
      throw new AppError(422, 'LINK_UNREADABLE', 'That page is too large to read')
    }
    const text = await response.text()
    return text.slice(0, MAX_BYTES)
  }
  throw new AppError(422, 'LINK_UNREADABLE', 'That link redirected too many times')
}
