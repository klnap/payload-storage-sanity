import type { SanityClient } from '@sanity/client'
import type { Payload } from 'payload'

import { mergeMediaSync, readMediaSync } from '../utils/mediaSync'
import type { PayloadMediaDraft } from '../utils/payloadMedia'
import { isPayloadDocumentId, type PayloadDocumentId } from '../utils/payloadDocumentId'
import { createSanityAssetFetchCache } from '../utils/sanityAssetCache'
import { fetchSanityAssetSafe, mediaPatchFromSanityAsset } from './fetchAsset'
import {
  countDuplicatesInGroups,
  recordMediaRowForDuplicateCount,
  type MediaRowForDedupe,
} from './countDuplicateMediaRows'
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
  mediaId?: PayloadDocumentId
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
  /** Media rows sharing sanity.id + sha1hash with an older row (dedupe orphans). */
  duplicates: number
  rows: ReconcileMediaRow[]
}

export type ReconcileHttpResponse =
  | {
      dryRun: false
      scanned: number
      updated: number
      duplicates: number
    }
  | {
      dryRun: true
      scanned: number
      wouldUpdate: number
      duplicates: number
    }

/** Summary JSON for `POST /api/.../reconcile` (full `ReconcileReport` remains for `reconcileSanityMedia`). */
export function formatReconcileHttpResponse(report: ReconcileReport): ReconcileHttpResponse {
  const changed = report.synced + report.markedUnavailable
  if (report.dryRun) {
    return {
      dryRun: true,
      scanned: report.scanned,
      wouldUpdate: changed,
      duplicates: report.duplicates,
    }
  }
  return {
    dryRun: false,
    scanned: report.scanned,
    updated: changed,
    duplicates: report.duplicates,
  }
}

function reconcileErrorMessage(error: Error): string {
  return error.message
}

async function processReconcileDoc(
  options: ReconcileOptions,
  report: ReconcileReport,
  cache: ReturnType<typeof createSanityAssetFetchCache>,
  mediaDoc: PayloadMediaDraft & { id?: PayloadDocumentId }
): Promise<void> {
  const { payload, client, collectionSlug, dryRun = false, req } = options
  const mediaId = mediaDoc.id
  const rawAssetId = mediaDoc.sanity?.id ?? mediaDoc.sanityAssetId
  const sanityAssetId = rawAssetId && rawAssetId.trim().length > 0 ? rawAssetId : null
  const previousStatus = readMediaSync(mediaDoc).status

  try {
    if (!isPayloadDocumentId(mediaId) || sanityAssetId == null) {
      report.skipped += 1
      report.rows.push({
        ...(isPayloadDocumentId(mediaId) ? { mediaId } : {}),
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
      ...(isPayloadDocumentId(mediaId) ? { mediaId } : {}),
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
    duplicates: 0,
    rows: [],
  }

  const cache = createSanityAssetFetchCache()
  const duplicateGroups = new Map<string, MediaRowForDedupe[]>()
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
      overrideAccess: true,
      req,
    })

    for (const doc of result.docs) {
      report.scanned += 1
      const mediaDoc = doc as PayloadMediaDraft & { id?: PayloadDocumentId }
      recordMediaRowForDuplicateCount(duplicateGroups, mediaDoc as MediaRowForDedupe)
      // SAFETY: doc returned from media find conforms to media document structure
      await processReconcileDoc(options, report, cache, mediaDoc)
    }

    hasNextPage = result.hasNextPage === true
    page += 1
  }

  report.duplicates = countDuplicatesInGroups(duplicateGroups)

  return report
}
