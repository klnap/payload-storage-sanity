import type { CollectionBeforeChangeHook } from 'payload'
import {
  isUnsetSyncStatus,
  readMediaSync,
  resolveMediaSyncStatus,
  type WithMediaSync,
} from '@/features/asset-sync'
import type { SanityMediaDocument } from '@/features/media/document'
import { normalizeLocalizedAltGroup } from '@/features/media/fields'
import { getSanityAssetId } from '@/sanity/assets'
import { hasUpstreamLocators, stripMediaDocumentJunkKeys } from '../sanitizeDocument'

export type CreateSanityMediaBeforeChangeHookArgs = {
  localizedAltGroup?: boolean
}

function documentHasMediaFields(doc: SanityMediaDocument): boolean {
  return (
    Boolean(getSanityAssetId(doc)?.trim()) ||
    hasUpstreamLocators(doc) ||
    Boolean(doc.filename && doc.filename.trim().length > 0)
  )
}

export function createSanityMediaBeforeChangeHook(
  args: CreateSanityMediaBeforeChangeHookArgs = {}
): CollectionBeforeChangeHook {
  return ({ data, operation, originalDoc }) => {
    if (!data) return data

    let mediaData = stripMediaDocumentJunkKeys(
      data as SanityMediaDocument & Record<string, unknown>
    ) as SanityMediaDocument

    if (args.localizedAltGroup) {
      mediaData = {
        ...mediaData,
        alt: normalizeLocalizedAltGroup(mediaData.alt, true) as SanityMediaDocument['alt'],
      }
    }
    const previous = originalDoc as SanityMediaDocument | undefined
    const hasMedia =
      documentHasMediaFields(mediaData) ||
      (operation === 'update' && previous != null && documentHasMediaFields(previous))

    if (!hasMedia) {
      return mediaData as typeof data
    }

    const inferDoc =
      operation === 'update' && previous != null ? { ...previous, ...mediaData } : mediaData
    const priorSync = operation === 'update' && previous ? readMediaSync(previous) : {}
    const sync = { ...priorSync, ...readMediaSync(mediaData as WithMediaSync) }
    let status = resolveMediaSyncStatus({
      stored: sync.status,
      hasAssetId: Boolean(getSanityAssetId(inferDoc)?.trim()),
      hasUpstream: hasUpstreamLocators(inferDoc),
      defaultWhenUnset: operation === 'create' ? 'available' : 'unknown',
    })
    // Fresh uploads: placeholder/empty sync → available until reconcile proves otherwise.
    if (operation === 'create' && isUnsetSyncStatus(sync.status)) {
      status = 'available'
    }
    const checkedAt = sync.checkedAt ?? new Date().toISOString()

    const result = {
      ...mediaData,
      sync: {
        ...sync,
        status,
        checkedAt,
      },
    }

    return result as typeof data
  }
}
