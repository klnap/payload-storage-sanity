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
  const byCollection = new Map<string, { label: string; documentIds: Set<number | string> }>()

  for (const entry of entries) {
    let bucket = byCollection.get(entry.collectionSlug)
    if (!bucket) {
      bucket = {
        label: entry.collectionLabel || entry.collectionSlug,
        documentIds: new Set(),
      }
      byCollection.set(entry.collectionSlug, bucket)
    }
    bucket.documentIds.add(entry.id)
  }

  const collections: MediaCollectionUsageSummary[] = Array.from(byCollection.entries())
    .map(([slug, bucket]) => ({
      collectionSlug: slug,
      collectionLabel: bucket.label,
      distinctDocumentsCount: bucket.documentIds.size,
    }))
    .sort((a, b) => a.collectionSlug.localeCompare(b.collectionSlug))

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
        `${c.distinctDocumentsCount} ${c.collectionLabel} document${c.distinctDocumentsCount === 1 ? '' : 's'}`
    )
    .join(', ')

  return `Cannot delete media asset because it is currently referenced by ${summary.totalDistinctDocuments} document${summary.totalDistinctDocuments === 1 ? '' : 's'} (${breakdown}).`
}
