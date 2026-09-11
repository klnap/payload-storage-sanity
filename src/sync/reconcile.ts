import type { SanityClient } from '@sanity/client'
import type { Payload } from 'payload'

import { mergeMediaSync, readMediaSync } from '../utils/mediaSync'
import type { PayloadMediaDraft } from '../utils/payloadMedia'
import { createSanityAssetFetchCache } from '../utils/sanityAssetCache'
import { fetchSanityAssetSafe, mediaPatchFromSanityAsset } from './fetchAsset'
import { markMediaBySanityAssetId } from './markMedia'
import type { SanitySyncStatus } from './status'

export type ReconcileOptions = {
  payload: Payload
  client: SanityClient
  collectionSlug: string
  dryRun?: boolean
  /** Page size for paginated scans. */
  limit?: number
  req?: Parameters<Payload['find']>[0]['req']
}

export type ReconcileMediaRow = {
  mediaId: number
  sanityAssetId: string
  previousStatus: SanitySyncStatus | null | undefined
  nextStatus: SanitySyncStatus
  action: 'synced' | 'marked-unavailable' | 'skipped' | 'error'
  message?: string
}

export type ReconcileReport = {
  dryRun: boolean
  scanned: number
  synced: number
  markedUnavailable: number
  skipped: number
  errors: number
  rows: ReconcileMediaRow[]
}

function reconcileErrorMessage(error: Error): string {
  return error.message
}

async function processReconcileDoc(
  options: ReconcileOptions,
  report: ReconcileReport,
  cache: ReturnType<typeof createSanityAssetFetchCache>,
  mediaDoc: PayloadMediaDraft & { id?: number }
): Promise<void> {
  const { payload, client, collectionSlug, dryRun = false, req } = options
  const mediaId = mediaDoc.id
  const rawAssetId = mediaDoc.sanity_id ?? mediaDoc.sanityAssetId
  const sanityAssetId = rawAssetId && rawAssetId.trim().length > 0 ? rawAssetId : null
  const previousStatus = readMediaSync(mediaDoc).status

  try {
    if (mediaId == null || !Number.isFinite(mediaId) || sanityAssetId == null) {
      report.skipped += 1
      report.rows.push({
        mediaId: mediaId != null && Number.isFinite(mediaId) ? mediaId : 0,
        sanityAssetId: sanityAssetId ?? '',
        previousStatus,
        nextStatus: previousStatus ?? 'missing',
        action: 'skipped',
        message: 'No Sanity asset ID on media row',
      })
      return
    }

    const result = await fetchSanityAssetSafe(client, sanityAssetId, cache)

    if (result.status === 'available') {
      if (!dryRun) {
        const patch = mediaPatchFromSanityAsset(result.asset)
        await payload.update({
          collection: collectionSlug,
          id: mediaId,
          data: {
            ...patch,
            ...mergeMediaSync(mediaDoc, {
              status: 'available',
              checkedAt: new Date().toISOString(),
              errorAt: null,
            }),
          },
          req,
        })
      }

      report.synced += 1
      report.rows.push({
        mediaId,
        sanityAssetId,
        previousStatus,
        nextStatus: 'available',
        action: 'synced',
      })
      return
    }

    const nextStatus: SanitySyncStatus = result.status

    if (!dryRun) {
      await markMediaBySanityAssetId({
        payload,
        collectionSlug,
        sanityAssetId,
        status: nextStatus,
        errorAt: new Date().toISOString(),
        req,
      })
    }

    report.markedUnavailable += 1
    report.rows.push({
      mediaId,
      sanityAssetId,
      previousStatus,
      nextStatus,
      action: 'marked-unavailable',
      message: result.message,
    })
  } catch (error) {
    report.errors += 1
    report.rows.push({
      mediaId: mediaId != null && Number.isFinite(mediaId) ? mediaId : 0,
      sanityAssetId: sanityAssetId ?? '',
      previousStatus,
      nextStatus: 'error',
      action: 'error',
      message: error instanceof Error ? reconcileErrorMessage(error) : 'Unknown reconcile error',
    })
  }
}

/** Reconciles all media rows against upstream Sanity asset state. */
export async function reconcileSanityMedia(options: ReconcileOptions): Promise<ReconcileReport> {
  const { payload, collectionSlug, limit = 500, dryRun = false, req } = options

  const report: ReconcileReport = {
    dryRun,
    scanned: 0,
    synced: 0,
    markedUnavailable: 0,
    skipped: 0,
    errors: 0,
    rows: [],
  }

  const cache = createSanityAssetFetchCache()
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    // SAFETY: collectionSlug is a validated collection name
    const result = await payload.find({
      collection: collectionSlug as never,
      depth: 0,
      limit,
      page,
      pagination: true,
      req,
    })

    for (const doc of result.docs) {
      report.scanned += 1
      // SAFETY: doc returned from media find conforms to media document structure
      await processReconcileDoc(options, report, cache, doc as PayloadMediaDraft & { id?: number })
    }

    hasNextPage = result.hasNextPage === true
    page += 1
  }

  return report
}
