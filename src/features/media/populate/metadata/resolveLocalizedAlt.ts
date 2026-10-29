export type ResolveLocalizedAltContext = {
  /** Request locale (`req.locale` / SDK `locale`). Required for localized `alt` objects. */
  locale?: string | null
  /** When `locale` is missing or empty in the group, try this locale key. */
  fallbackLocale?: string | null
}

function pickString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

/** Plain string `alt`, or `alt[locale]` with optional `fallbackLocale`. */
export function resolveLocalizedAlt(
  value: unknown,
  ctx: ResolveLocalizedAltContext = {}
): string | null {
  const direct = pickString(value)
  if (direct) return direct

  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const locale = ctx.locale?.trim()
  if (locale) {
    const forLocale = pickString(record[locale])
    if (forLocale) return forLocale
  }

  const fallbackLocale = ctx.fallbackLocale?.trim()
  if (fallbackLocale && fallbackLocale !== locale) {
    return pickString(record[fallbackLocale])
  }

  return null
}
