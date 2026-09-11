import type { MediaUsageEntry } from '../queries/findMediaUsage'

export type MediaCollectionUsageSummary = {
  collectionSlug: string
  collectionLabel: string
  distinctDocumentsCount: number
}

export type MediaUsageSummary = {
  totalDistinctDocuments: number
  collections: MediaCollectionUsageSummary[]
}

export function summarizeMediaUsage(entries: MediaUsageEntry[]): MediaUsageSummary {
  const bySource = new Map<string, { label: string; type: string; documentIds: Set<number | string> }>()

  for (const entry of entries) {
    const key = `${entry.type}:${entry.collectionSlug}`
    let bucket = bySource.get(key)
    if (!bucket) {
      bucket = {
        label: entry.name || entry.collectionLabel || entry.collectionSlug,
        type: entry.type ?? 'collection',
        documentIds: new Set(),
      }
      bySource.set(key, bucket)
    }
    bucket.documentIds.add(entry.id)
  }

  const collections: MediaCollectionUsageSummary[] = Array.from(bySource.entries())
    .map(([key, bucket]) => ({
      collectionSlug: key,
      collectionLabel: bucket.type === 'global' ? `${bucket.label} (Global)` : bucket.label,
      distinctDocumentsCount: bucket.documentIds.size,
    }))
    .sort((a, b) => a.collectionLabel.localeCompare(b.collectionLabel))

  const totalDistinctDocuments = collections.reduce((sum, c) => sum + c.distinctDocumentsCount, 0)

  return {
    totalDistinctDocuments,
    collections,
  }
}

export function formatMediaUsageBlockMessage(entries: MediaUsageEntry[]): string {
  const summary = summarizeMediaUsage(entries)
  if (summary.totalDistinctDocuments === 0) {
    return 'Cannot delete media asset because it is currently referenced by other documents.'
  }

  const breakdown = summary.collections
    .map(
      (c) =>
        `${c.distinctDocumentsCount} ${c.collectionLabel}`
    )
    .join(', ')

  return `Cannot delete media asset because it is currently referenced by ${summary.totalDistinctDocuments} entity${summary.totalDistinctDocuments === 1 ? '' : 'ies'} (${breakdown}).`
}
