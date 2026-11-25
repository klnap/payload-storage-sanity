/** Nested `populate` / `forceSelect` shape for localized alt group (`alt.pl`, `alt.en`, …). */
export function localizedAltPopulateSelect(
  localeCodes: readonly string[]
): true | Record<string, true> {
  if (localeCodes.length === 0) {
    return true
  }

  const select: Record<string, true> = {}
  for (const code of localeCodes) {
    if (code.trim()) {
      select[code] = true
    }
  }

  return Object.keys(select).length > 0 ? select : true
}
