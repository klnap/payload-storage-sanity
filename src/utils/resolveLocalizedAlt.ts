export type ResolveLocalizedAltContext = {
  /** Request locale (`req.locale` / SDK `locale`). Required for localized `alt` objects. */
  locale?: string | null
}

function pickString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

/** Plain string `alt`, or `alt[locale]` only — no fallback to other locales. */
export function resolveLocalizedAlt(
  value: unknown,
  ctx: ResolveLocalizedAltContext = {}
): string | null {
  const direct = pickString(value)
  if (direct) return direct

  const locale = ctx.locale?.trim()
  if (!locale) return null

  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return pickString((value as Record<string, unknown>)[locale])
}
