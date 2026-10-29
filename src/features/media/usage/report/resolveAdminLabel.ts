export function resolveAdminLabel(
  value: unknown,
  locale?: string | null,
  defaultLocale?: string | null
): string {
  if (value == null) return ''

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const preferred = [locale, defaultLocale, 'en', 'pl'].filter(
      (entry): entry is string => typeof entry === 'string' && entry.length > 0
    )

    for (const key of preferred) {
      const entry = record[key]
      if (typeof entry === 'string' && entry.trim().length > 0) {
        return entry
      }
    }

    for (const entry of Object.values(record)) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        return entry
      }
    }
  }

  return ''
}
