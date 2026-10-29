import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'
import type { MediaUsageEntry } from '@/features/media/usage'

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
  const bySource = new Map<
    string,
    { label: string; type: string; documentIds: Set<number | string> }
  >()

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
      collectionLabel: bucket.label,
      distinctDocumentsCount: bucket.documentIds.size,
    }))
    .sort((a, b) => a.collectionLabel.localeCompare(b.collectionLabel))

  const totalDistinctDocuments = collections.reduce((sum, c) => sum + c.distinctDocumentsCount, 0)

  return {
    totalDistinctDocuments,
    collections,
  }
}

export function resolveMediaDeleteLabel(
  doc: { filename?: string | null; name?: string | null } | null | undefined,
  id: number | string
): string {
  const filename = typeof doc?.filename === 'string' ? doc.filename.trim() : ''
  if (filename.length > 0) {
    return filename
  }

  const name = typeof doc?.name === 'string' ? doc.name.trim() : ''
  if (name.length > 0) {
    return name
  }

  const idStr = String(id)
  if (idStr.length > 12) {
    return `${idStr.slice(0, 8)}…`
  }
  return idStr
}

function usageCountNoun(t: SanityStorageTranslateFn, count: number): string {
  return count === 1
    ? sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.mediaUsageDocument)
    : sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.mediaUsageDocuments)
}

export function formatMediaUsageCompactDeleteMessage(
  t: SanityStorageTranslateFn,
  mediaLabel: string,
  entries: MediaUsageEntry[]
): string {
  const summary = summarizeMediaUsage(entries)
  const count = summary.totalDistinctDocuments
  return sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.mediaDeleteCompact, {
    mediaLabel,
    count: String(count),
    noun: usageCountNoun(t, count),
  })
}

export function formatMediaUsageBlockMessage(
  t: SanityStorageTranslateFn,
  entries: MediaUsageEntry[]
): string {
  const summary = summarizeMediaUsage(entries)
  if (summary.totalDistinctDocuments === 0) {
    return sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.mediaDeleteBlockGeneric)
  }

  const count = summary.totalDistinctDocuments

  return sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.mediaDeleteBlock, {
    count: String(count),
    noun: usageCountNoun(t, count),
  })
}
