/** Stored asset URLs are rendered as links: only http(s) targets are allowed. */
export function safeAssetHref(url: string): string | undefined {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'https:' || protocol === 'http:' ? url : undefined
  } catch {
    return undefined
  }
}
