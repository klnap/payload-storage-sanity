// Linear scan: a regex such as /\/+$/ backtracks quadratically on long runs of slashes.
export function trimTrailingSlash(origin: string): string {
  let end = origin.length
  while (end > 0 && origin.charCodeAt(end - 1) === 47) end -= 1
  return origin.slice(0, end)
}

/** Join CDN origin and Sanity asset path without losing origin path prefix or doubling slashes. */
export function joinCdnOriginAndPath(origin: string, path: string): string {
  const base = trimTrailingSlash(origin)
  let start = 0
  while (start < path.length && path.charCodeAt(start) === 47) start += 1
  const segment = path.slice(start)
  if (segment.length === 0) return base
  return `${base}/${segment}`
}
