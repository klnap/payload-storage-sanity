import type { Payload } from 'payload'
import type { PayloadDocumentId } from '@/core/contracts'
import type { SanitySyncStatus, WithMediaSync } from '@/features/asset-sync'
import { mergeMediaSync } from '@/features/asset-sync'
import type { PayloadMediaPatch } from '@/features/media/document'
import { SANITY_UPSTREAM_WRITE_CONTEXT_KEY } from '@/features/media/fields'
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
  /**
   * `true` runs the row reads and writes under the request's own Payload access. Use it for
   * operator-initiated work (reconcile). The Sanity webhook is a signed system call and keeps `false`.
   */
  enforceAccess?: boolean
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
  enforceAccess = false,
}: MarkMediaSyncArgs): Promise<PayloadDocumentId[]> {
  const effectiveStatus = status ?? syncStatus ?? 'missing'
  const overrideAccess = !enforceAccess

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
      overrideAccess,
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

    // The sync group only accepts plugin-owned upstream writes, even when access is enforced.
    // Restore the request context so the flag cannot outlive this write.
    const previousContext = req?.context
    try {
      await payload.update({
        collection: collectionSlug,
        id,
        data,
        depth: 0,
        overrideAccess,
        context: { [SANITY_UPSTREAM_WRITE_CONTEXT_KEY]: true },
        req,
      })
    } finally {
      if (req) req.context = previousContext
    }

    updatedIds.push(id)
  }

  return updatedIds
}
