export function trimTrailingSlash(origin: string): string {
  return origin.replace(/\/+$/, '')
}

/** Join CDN origin and Sanity asset path without losing origin path prefix or doubling slashes. */
export function joinCdnOriginAndPath(origin: string, path: string): string {
  const base = trimTrailingSlash(origin)
  const segment = path.replace(/^\/+/, '')
  if (segment.length === 0) return base
  return `${base}/${segment}`
}
