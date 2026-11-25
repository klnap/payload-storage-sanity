export type SanityCompatibleHostContext = {
  cdnBaseUrl?: string
}

function tryParseHost(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null

  if (!trimmed.includes('://') && !trimmed.startsWith('//')) {
    return trimmed.split('/')[0]?.split(':')[0]?.toLowerCase() ?? null
  }

  try {
    return new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isSanityCompatibleHost(
  input: string,
  ctx: SanityCompatibleHostContext = {}
): boolean {
  const host = tryParseHost(input)
  if (!host) return false

  if (host === 'cdn.sanity.io') return true

  const custom = ctx.cdnBaseUrl?.trim()
  if (custom) {
    const customHost = tryParseHost(custom)
    if (customHost && customHost === host) return true
  }

  return false
}
