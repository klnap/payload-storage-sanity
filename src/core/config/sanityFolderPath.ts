function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
}

export function parseSanityAssetFolderPath(path: unknown): string[] {
  if (typeof path !== 'string') {
    throw new Error('Sanity media folder must be a non-empty path.')
  }

  // Linear trim of leading and trailing slashes (regex alternation with \/+$ backtracks quadratically).
  const trimmed = path.trim()
  let start = 0
  let end = trimmed.length
  while (start < end && trimmed.charCodeAt(start) === 47) start += 1
  while (end > start && trimmed.charCodeAt(end - 1) === 47) end -= 1
  const normalized = trimmed.slice(start, end)
  const segments = normalized.split('/').map((segment) => segment.trim())
  if (
    !normalized ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('\\') ||
        hasControlCharacters(segment)
    )
  ) {
    throw new Error('Sanity media folder must contain non-empty path segments without "." or "..".')
  }

  return segments
}
