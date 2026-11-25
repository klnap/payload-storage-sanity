import type { SanityClient } from '@sanity/client'
import type { Payload, PayloadRequest } from 'payload'
import {
  createSanityAssetFetchCache,
  fetchSanityAssetSafe,
  markMediaBySanityAssetId,
} from '@/features/asset-sync'
import { lockSanityAssetHash, sanityAssetHashFromId } from '@/features/media/lifecycle/asset-lock'

export type AtomicAssetDeleteOutcome =
  | { kind: 'deleted'; rows: number }
  | { kind: 'kept'; reason: string }
  | { kind: 'failed'; error: unknown }

/**
 * Deletes the media rows of one Sanity asset, and their upstream asset, as one unit. The content-hash
 * lock makes an upload of the same bytes wait or finish first, and upstream is read again after the lock
 * because that reading is the only one that reflects those uploads. Any failure rolls the whole asset
 * back, so a deleted-event webhook never leaves a partially deleted asset behind.
 */
export async function deleteSanityAssetRowsAtomically({
  payload,
  client,
  collectionSlug,
  sanityAssetId,
  req,
}: {
  payload: Payload
  client: SanityClient
  collectionSlug: string
  sanityAssetId: string
  req?: Partial<PayloadRequest>
}): Promise<AtomicAssetDeleteOutcome> {
  const db = payload.db as Payload['db'] | undefined
  if (db == null || typeof db.beginTransaction !== 'function') {
    return { kind: 'kept', reason: 'no database transaction' }
  }
  const sha1 = sanityAssetHashFromId(sanityAssetId)
  if (sha1 == null) {
    return { kind: 'kept', reason: 'asset id is not content-addressed' }
  }

  const transactionID = await db.beginTransaction()
  if (transactionID == null) {
    return { kind: 'kept', reason: 'no database transaction' }
  }
  const txReq = { ...(req ?? {}), payload, transactionID } as unknown as PayloadRequest

  let committed = false
  try {
    const locked = await lockSanityAssetHash(txReq, sha1)
    if (!locked) {
      return { kind: 'kept', reason: 'database adapter has no transaction lock' }
    }

    const upstream = await fetchSanityAssetSafe(
      client,
      sanityAssetId,
      createSanityAssetFetchCache()
    )
    if (upstream.status !== 'missing') {
      return { kind: 'kept', reason: `upstream status ${upstream.status}` }
    }

    const mediaIds = await markMediaBySanityAssetId({
      payload,
      collectionSlug,
      sanityAssetId,
      syncStatus: 'deleted',
      req: txReq,
    })
    for (const mediaId of mediaIds) {
      await payload.delete({
        collection: collectionSlug as never,
        id: mediaId,
        overrideAccess: true,
        req: txReq,
      })
    }

    await db.commitTransaction(transactionID)
    committed = true
    return { kind: 'deleted', rows: mediaIds.length }
  } catch (error) {
    return { kind: 'failed', error }
  } finally {
    if (!committed) {
      await db.rollbackTransaction(transactionID).catch(() => undefined)
    }
  }
}
