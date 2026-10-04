import type { MediaUsageEntry } from './findMediaUsage'

/** One logical place (document + field) that references media. */
export function mediaUsageDocumentFieldKey(
  entry: Pick<MediaUsageEntry, 'type' | 'collectionSlug' | 'id' | 'fieldPath'>
): string {
  return `${entry.type}:${entry.collectionSlug}:${String(entry.id)}:${entry.fieldPath}`
}

/**
 * One row per document+field — the reference that matters for delete blocking.
 * Prefers **published** over draft; prefers version deep-links over list/edit URLs.
 */
export function collapseMediaUsageEntries(entries: MediaUsageEntry[]): MediaUsageEntry[] {
  const groups = new Map<string, MediaUsageEntry[]>()

  for (const entry of entries) {
    const key = mediaUsageDocumentFieldKey(entry)
    const list = groups.get(key) ?? []
    list.push(entry)
    groups.set(key, list)
  }

  const collapsed: MediaUsageEntry[] = []
  for (const group of groups.values()) {
    collapsed.push(pickBlockingDisplayEntry(group))
  }

  return collapsed.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'collection' ? -1 : 1
    }
    const byName = a.title.localeCompare(b.title)
    if (byName !== 0) return byName
    return a.fieldLabel.localeCompare(b.fieldLabel)
  })
}

function pickBlockingDisplayEntry(group: MediaUsageEntry[]): MediaUsageEntry {
  const published = group.filter((e) => e.referenceLayer === 'published')
  const pool = published.length > 0 ? published : group
  return pool.find((e) => e.versionId != null) ?? pool[0]
}
