import type { Payload } from 'payload'
import type { PayloadDocumentId } from '@/core/contracts'
import type { SanitySyncStatus, WithMediaSync } from '@/features/asset-sync'
import { mergeMediaSync } from '@/features/asset-sync'
import type { PayloadMediaPatch } from '@/features/media/document'
import { findAllMediaBySanityAssetId } from '@/features/media/usage'

export type MarkMediaSyncArgs = {
  payload: Payload
  collectionSlug: string
  sanityAssetId: string
  syncStatus?: SanitySyncStatus
  status?: SanitySyncStatus
  errorAt?: string | null
  patch?: PayloadMediaPatch
  req?: Parameters<Payload['update']>[0]['req']
}

/** Updates every Payload media row that references a Sanity asset `_id`. */
export async function markMediaBySanityAssetId({
  payload,
  collectionSlug,
  sanityAssetId,
  syncStatus,
  status,
  errorAt,
  patch = {},
  req,
}: MarkMediaSyncArgs): Promise<PayloadDocumentId[]> {
  const effectiveStatus = status ?? syncStatus ?? 'missing'

  const matches = await findAllMediaBySanityAssetId({
    payload,
    collectionSlug,
    sanityAssetId,
    req,
  })

  const updatedIds: PayloadDocumentId[] = []

  for (const { id } of matches) {
    const doc = await payload.findByID({
      collection: collectionSlug,
      depth: 0,
      id,
      overrideAccess: true,
      disableErrors: true,
      req,
    })

    if (doc == null) continue

    const data: PayloadMediaPatch = {
      ...patch,
      ...mergeMediaSync(
        // SAFETY: findByID returns a media row compatible with WithMediaSync
        doc as WithMediaSync,
        {
          status: effectiveStatus,
          checkedAt: new Date().toISOString(),
          errorAt: errorAt !== undefined ? errorAt : undefined,
        }
      ),
    }

    await payload.update({
      collection: collectionSlug,
      id,
      data,
      depth: 0,
      overrideAccess: true,
      req,
    })

    updatedIds.push(id)
  }

  return updatedIds
}
