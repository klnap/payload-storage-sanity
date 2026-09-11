import type { SanityClient } from '@sanity/client'
import type { Payload } from 'payload'

import { findAllMediaBySanityAssetId } from '../queries/findAllMediaBySanityAssetId'

export async function deleteSanityAsset(client: SanityClient, assetId: string): Promise<void> {
  if (!assetId || assetId.trim().length === 0) return
  await client.delete(assetId)
}

export type DeleteSanityAssetIfUnreferencedArgs = {
  client: SanityClient
  payload: Payload
  collectionSlug: string
  sanityAssetId: string
  /** Media row being updated or deleted — excluded from the reference count. */
  excludingMediaId?: number
  req?: Parameters<Payload['find']>[0]['req']
}

/**
 * Deletes a Sanity asset only when no remaining Payload media rows reference it.
 * Prevents orphaned upstream assets from being removed while still referenced.
 */
export async function deleteSanityAssetIfUnreferenced({
  client,
  payload,
  collectionSlug,
  sanityAssetId,
  excludingMediaId,
  req,
}: DeleteSanityAssetIfUnreferencedArgs): Promise<boolean> {
  const references = await findAllMediaBySanityAssetId({
    payload,
    collectionSlug,
    sanityAssetId,
    req,
  })

  const remaining =
    excludingMediaId == null
      ? references
      : references.filter((entry) => entry.id !== excludingMediaId)

  if (remaining.length > 0) {
    return false
  }

  await deleteSanityAsset(client, sanityAssetId)
  return true
}

export async function deleteReplacedSanityAsset(
  client: SanityClient,
  previousAssetId: string | null,
  nextAssetId: string | null,
  options?: {
    payload: Payload
    collectionSlug: string
    mediaId?: number
    req?: Parameters<Payload['find']>[0]['req']
  }
): Promise<void> {
  if (!previousAssetId || !nextAssetId || previousAssetId === nextAssetId) return

  if (options?.payload && options.collectionSlug) {
    await deleteSanityAssetIfUnreferenced({
      client,
      payload: options.payload,
      collectionSlug: options.collectionSlug,
      sanityAssetId: previousAssetId,
      excludingMediaId: options.mediaId,
      req: options.req,
    })
    return
  }

  await deleteSanityAsset(client, previousAssetId)
}
