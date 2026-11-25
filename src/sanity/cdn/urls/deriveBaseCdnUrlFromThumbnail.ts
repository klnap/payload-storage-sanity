export function isPersistedHttpUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('http://') || value.startsWith('https://')) &&
    value.trim().length > 0
  )
}

/** Strips Sanity image transform query params from a thumbnail URL. */
export function deriveBaseCdnUrlFromThumbnail(
  thumbnailURL: string | null | undefined
): string | null {
  if (!isPersistedHttpUrl(thumbnailURL)) {
    return null
  }

  try {
    const parsed = new URL(thumbnailURL)
    parsed.searchParams.delete('w')
    parsed.searchParams.delete('h')
    parsed.searchParams.delete('fit')
    parsed.searchParams.delete('auto')
    const search = parsed.searchParams.toString()
    return `${parsed.origin}${parsed.pathname}${search ? `?${search}` : ''}`
  } catch {
    return thumbnailURL
  }
}
