/** Localized alt is a group (`alt.pl`, `alt.en`). Payload form state breaks when `alt` is SQL `null`. */
export function normalizeLocalizedAltGroup(
  alt: unknown,
  localizedAltGroup: boolean
): unknown {
  if (!localizedAltGroup) {
    return alt
  }

  if (alt === null) {
    return {}
  }

  if (typeof alt === 'object' && !Array.isArray(alt)) {
    return alt
  }

  return alt
}
