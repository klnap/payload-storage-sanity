/** Media `alt` value shape accepted by the storage adapter. */
export type MediaAltValue = string | Record<string, string | null> | null | undefined

/** Localized alt is a group (`alt.pl`, `alt.en`). Payload form state breaks when `alt` is SQL `null`. */
export function normalizeLocalizedAltGroup(
  alt: MediaAltValue,
  localizedAltGroup: boolean
): MediaAltValue {
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
