import type { SanityClient } from '@sanity/client'
import type { CollectionBeforeDeleteHook } from 'payload'

import { sanityAssetIdFromDocument } from '../adapter/metadata'
import type { PayloadMediaDraft } from '../utils/payloadMedia'
import { deleteSanityAssetIfUnreferenced } from '../utils/retention'

/** Deletes the upstream Sanity asset when the last referencing media row is removed. */
export function createMediaDeleteSanityAssetBeforeDeleteHook(
  client: SanityClient,
  collectionSlug: string
): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    if (req.context?.skipCloudStorage) return

    const doc = await req.payload.findByID({
      collection: collectionSlug,
      depth: 0,
      id,
      draft: true,
      overrideAccess: true,
      disableErrors: true,
      req,
    })

    if (doc == null) return

    // SAFETY: findByID returns media rows with optional Sanity adapter fields
    const assetId = sanityAssetIdFromDocument(doc as PayloadMediaDraft)
    if (!assetId) return

    const mediaId = id != null && Number.isFinite(id) ? Number(id) : undefined

    await deleteSanityAssetIfUnreferenced({
      client,
      payload: req.payload,
      collectionSlug,
      sanityAssetId: assetId,
      excludingMediaId: mediaId,
      req,
    })
  }
}
