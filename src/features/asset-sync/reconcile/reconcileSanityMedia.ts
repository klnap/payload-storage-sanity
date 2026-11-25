import type { SanityClient } from '@sanity/client'
import type { Payload } from 'payload'
import { isPayloadDocumentId, type PayloadDocumentId } from '@/core/contracts'
import type { SanitySyncStatus } from '@/features/asset-sync'
import {
  countDuplicatesInGroups,
  createSanityAssetFetchCache,
  fetchSanityAssetSafe,
  type MediaRowForDedupe,
  markMediaBySanityAssetId,
  mediaPatchFromSanityAsset,
  mergeMediaSync,
  readMediaSync,
  recordMediaRowForDuplicateCount,
} from '@/features/asset-sync'
import type { PayloadMediaDraft } from '@/features/media/document'
import { SANITY_UPSTREAM_WRITE_CONTEXT_KEY } from '@/features/media/fields'
import { getSanityAssetId } from '@/sanity/assets'

/** Upstream asset reads in flight at once for one reconcile run. */
export const RECONCILE_CONCURRENCY = 4
/** Rows processed per request when the caller does not set `maxRows`. */
export const RECONCILE_DEFAULT_MAX_ROWS = 1000
/** Hard ceiling for `maxRows`, enforced at the HTTP boundary as well. */
export const RECONCILE_MAX_ROWS_CAP = 5000

export type ReconcileOptions = {
  payload: Payload
  client: SanityClient
  collectionSlug: string
  dryRun?: boolean
  /** Page size for paginated scans. */
  limit?: number
  /** Total rows this run may process before it stops and reports `truncated`. */
  maxRows?: number
  /** First page to scan (resume point from a previous truncated run). */
  startPage?: number
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
  /** Media rows sharing sanity.asset._id + sha1hash with an older row (dedupe orphans). */
  duplicates: number
  /** The run stopped at `maxRows` before every row was processed. */
  truncated: boolean
  /** Page to pass as `startPage` to continue a truncated run. */
  nextPage: number | null
  rows: ReconcileMediaRow[]
}

export type ReconcileHttpResponse =
  | {
      dryRun: false
      scanned: number
      updated: number
      duplicates: number
      truncated: boolean
      nextPage: number | null
    }
  | {
      dryRun: true
      scanned: number
      wouldUpdate: number
      duplicates: number
      truncated: boolean
      nextPage: number | null
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
      truncated: report.truncated,
      nextPage: report.nextPage,
    }
  }
  return {
    dryRun: false,
    scanned: report.scanned,
    updated: changed,
    duplicates: report.duplicates,
    truncated: report.truncated,
    nextPage: report.nextPage,
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
  const rawAssetId = getSanityAssetId(mediaDoc)
  const sanityAssetId = rawAssetId && rawAssetId.trim().length > 0 ? rawAssetId : null
  const previousStatus = readMediaSync(mediaDoc).status

  try {
    if (!isPayloadDocumentId(mediaId) || sanityAssetId == null) {
      report.skipped += 1
      report.rows.push({
        ...(isPayloadDocumentId(mediaId) ? { mediaId } : undefined),
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
        // Payload assigns the operation context onto `req` itself, so the upstream-write flag must be
        // undone afterwards or it would stay set for the rest of this request.
        const previousContext = req?.context
        try {
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
            // Reconcile runs as the caller: the media update permission decides, not the admin route gate.
            overrideAccess: false,
            // Upstream metadata refresh is the only client-facing path allowed to write `sanity.asset`.
            context: { [SANITY_UPSTREAM_WRITE_CONTEXT_KEY]: true },
            req,
          })
        } finally {
          if (req) req.context = previousContext
        }
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
        enforceAccess: true,
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
      ...(isPayloadDocumentId(mediaId) ? { mediaId } : undefined),
      sanityAssetId: sanityAssetId ?? '',
      previousStatus,
      nextStatus: 'error',
      action: 'error',
      message: error instanceof Error ? reconcileErrorMessage(error) : 'Unknown reconcile error',
    })
  }
}

/** Reconciles media rows against upstream Sanity asset state, bounded by `maxRows`. */
export async function reconcileSanityMedia(options: ReconcileOptions): Promise<ReconcileReport> {
  const {
    payload,
    collectionSlug,
    limit = 500,
    dryRun = false,
    req,
    maxRows = RECONCILE_DEFAULT_MAX_ROWS,
    startPage = 1,
  } = options

  const report: ReconcileReport = {
    dryRun,
    scanned: 0,
    synced: 0,
    markedUnavailable: 0,
    skipped: 0,
    errors: 0,
    duplicates: 0,
    truncated: false,
    nextPage: null,
    rows: [],
  }

  const cache = createSanityAssetFetchCache()
  const duplicateGroups = new Map<string, MediaRowForDedupe[]>()
  let page = startPage
  let hasNextPage = true

  while (hasNextPage) {
    // SAFETY: collectionSlug is a validated collection name
    const result = await payload.find({
      collection: collectionSlug as never,
      depth: 0,
      limit,
      page,
      pagination: true,
      overrideAccess: false,
      req,
    })

    const budget = Math.max(0, maxRows - report.scanned)
    const docs = result.docs.slice(0, budget)
    const pageHasUnprocessed = docs.length < result.docs.length

    for (let index = 0; index < docs.length; index += RECONCILE_CONCURRENCY) {
      const batch = docs.slice(index, index + RECONCILE_CONCURRENCY) as Array<
        PayloadMediaDraft & { id?: PayloadDocumentId }
      >
      for (const mediaDoc of batch) {
        report.scanned += 1
        recordMediaRowForDuplicateCount(duplicateGroups, mediaDoc as MediaRowForDedupe)
      }
      // Each row reports its own failure, so one bad upstream read does not stop the batch.
      await Promise.all(
        batch.map((mediaDoc) => processReconcileDoc(options, report, cache, mediaDoc))
      )
    }

    if (report.scanned >= maxRows && (pageHasUnprocessed || result.hasNextPage === true)) {
      report.truncated = true
      // A partly processed page restarts at that page; reprocessing its rows is idempotent.
      report.nextPage = pageHasUnprocessed ? page : page + 1
      break
    }

    hasNextPage = result.hasNextPage === true
    page += 1
  }

  report.duplicates = countDuplicatesInGroups(duplicateGroups)

  return report
}
