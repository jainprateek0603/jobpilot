export const logger = {
  info(message: string, extra?: unknown) {
    console.log(JSON.stringify({ level: 'info', message, extra }))
  },
  error(message: string, extra?: unknown) {
    console.error(JSON.stringify({ level: 'error', message, extra: serialize(extra) }))
  },
}

function serialize(extra: unknown) {
  if (extra instanceof Error) return { name: extra.name, message: extra.message }
  return extra
}
