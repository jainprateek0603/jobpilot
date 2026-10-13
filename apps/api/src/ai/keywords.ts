const STOP = new Set(
  'a an the and or for with from that this your you our their into onto over under than then job role work working team teams ability able using use used experience experiences including include etc per via are was were been have has will would can could about who what when where which need needs needed looking must should'.split(
    ' ',
  ),
)

export function significantWords(text: string): string[] {
  const counts = new Map<string, number>()
  for (const match of text.toLowerCase().matchAll(/[a-z][a-z0-9+#-]{2,}/g)) {
    const word = match[0]
    if (!word || STOP.has(word) || word.length > 40) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([word]) => word)
}

export function between(text: string, start: string, end: string): string {
  const from = text.indexOf(start)
  const to = text.indexOf(end, from + start.length)
  if (from < 0 || to < from) return ''
  return text.slice(from + start.length, to).trim()
}

export function labeled(text: string, label: string): string {
  const match = text.match(new RegExp(`^${label}:[ \\t]*(.*)$`, 'im'))
  return match?.[1]?.trim() ?? ''
}
