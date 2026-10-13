export type ListingHint = { company: string; role: string }

export function extractListing(html: string): ListingHint {
  const fromJson = readJobPosting(html)
  if (fromJson.company || fromJson.role) return fromJson
  const title = decodeHtml(metaContent(html, 'og:title') || tagText(html, 'title'))
  return splitTitle(title)
}

function readJobPosting(html: string): ListingHint {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scripts) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      const found = walk(parsed)
      if (found) return found
    } catch {
      continue
    }
  }
  return { company: '', role: '' }
}

function walk(node: unknown): ListingHint | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = walk(item)
      if (found) return found
    }
    return null
  }
  const record = node as Record<string, unknown>
  if (isJobPosting(record['@type'])) {
    const role = typeof record.title === 'string' ? clean(record.title) : ''
    const org = record.hiringOrganization
    const company =
      org && typeof org === 'object' && typeof (org as { name?: unknown }).name === 'string'
        ? clean((org as { name: string }).name)
        : ''
    if (company || role) return { company, role }
  }
  const graph = record['@graph']
  if (graph) return walk(graph)
  return null
}

function isJobPosting(type: unknown): boolean {
  if (typeof type === 'string') return type === 'JobPosting'
  return Array.isArray(type) && type.includes('JobPosting')
}

function metaContent(html: string, property: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return ''
}

function tagText(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return match?.[1] ?? ''
}

function splitTitle(title: string): ListingHint {
  const cleaned = clean(title)
  if (!cleaned) return { company: '', role: '' }
  const at = cleaned.split(/\s+at\s+/i)
  if (at.length === 2 && at[0] && at[1]) {
    return { role: clean(at[0]), company: clean((at[1].split(/[|–—-]/)[0] ?? at[1])) }
  }
  const parts = cleaned.split(/\s*[|–—]\s*/)
  if (parts.length >= 2 && parts[0] && parts[1]) return { role: clean(parts[0]), company: clean(parts[1]) }
  return { company: '', role: cleaned }
}

function decodeHtml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
}

function clean(value: string): string {
  return decodeHtml(value).replace(/\s+/g, ' ').trim()
}
