/** Empty text is preserved for decorative images; whitespace-only text is missing. */
export function normalizeAltText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value === '') return ''
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
