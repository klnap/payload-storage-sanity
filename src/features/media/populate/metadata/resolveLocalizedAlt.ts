import { normalizeAltText } from '@/consumers/image/normalizeAltText'

export type ResolveLocalizedAltContext = {
  /** Request locale (`req.locale` / SDK `locale`). Required for localized `alt` objects. */
  locale?: string | null
}

/**
 * `''` is explicitly empty (decorative). Whitespace-only text is treated as missing,
 * because Payload's `required` check accepts it and it is almost never a deliberate choice.
 */
export { normalizeAltText }

/**
 * Alt text for the requested locale only. Another locale is never substituted.
 * Returns `null` when the value is missing or has no translation for `locale`.
 * Returns `''` when the translation exists but is explicitly empty (decorative image).
 */
export function resolveLocalizedAlt(
  value: unknown,
  ctx: ResolveLocalizedAltContext = {}
): string | null {
  if (typeof value === 'string') return normalizeAltText(value)
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null

  const locale = ctx.locale?.trim()
  if (!locale) return null

  return normalizeAltText((value as Record<string, unknown>)[locale])
}
