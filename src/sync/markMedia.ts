import type { Payload } from 'payload'

import { findAllMediaBySanityAssetId } from '../queries/findAllMediaBySanityAssetId'
import type { WithMediaSync } from '../utils/mediaSync'
import { mergeMediaSync } from '../utils/mediaSync'
import type { PayloadMediaPatch } from '../utils/payloadMedia'
import type { SanitySyncStatus } from './status'

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
}: MarkMediaSyncArgs): Promise<number[]> {
  const effectiveStatus = status ?? syncStatus ?? 'missing'

  const matches = await findAllMediaBySanityAssetId({
    payload,
    collectionSlug,
    sanityAssetId,
    req,
  })

  const updatedIds: number[] = []

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

    const unavailable =
      effectiveStatus === 'missing' || effectiveStatus === 'deleted' || effectiveStatus === 'error'

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

    if (unavailable) {
      data.url = null
    }

    await payload.update({
      collection: collectionSlug,
      id,
      data,
      depth: 0,
      req,
    })

    updatedIds.push(id)
  }

  return updatedIds
}
