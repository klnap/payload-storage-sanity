import type { SanityClient } from '@sanity/client'
import { type Endpoint, getAccessResults, type PayloadHandler, type PayloadRequest } from 'payload'
import * as v from 'valibot'
import { parseJsonText } from '@/core/contracts'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'
import type { SanitySyncAccessFn } from '@/features/asset-sync'
import {
  defaultSanitySyncAccess,
  formatReconcileHttpResponse,
  readWebhookRawBody,
  reconcileSanityMedia,
} from '@/features/asset-sync'
import { RECONCILE_DEFAULT_MAX_ROWS, RECONCILE_MAX_ROWS_CAP } from './reconcileSanityMedia'

export type CreateSanityReconcileEndpointArgs = {
  client: SanityClient
  collectionSlug: string
  path?: string
  access?: SanitySyncAccessFn
  /** Whether the caller may update the media collection. Defaults to Payload's collection access result. */
  canUpdateMedia?: (req: PayloadRequest) => Promise<boolean>
}

const ReconcileBodySchema = v.object({
  dryRun: v.optional(v.boolean()),
  limit: v.optional(v.number()),
  maxRows: v.optional(v.number()),
  page: v.optional(v.number()),
})

/**
 * Reconcile reads every row and writes the sync state, so the caller needs update access to the media
 * collection. Checked before any upstream call: a read-only caller must not cause Sanity requests.
 */
export function canReconcileCollection(
  permissions:
    | { collections?: Record<string, { update?: unknown } | undefined> }
    | null
    | undefined,
  collectionSlug: string
): boolean {
  const update = permissions?.collections?.[collectionSlug]?.update
  return update === true || (typeof update === 'object' && update !== null)
}

/** Reconcile options are a few fields; larger bodies are rejected before parsing. */
const RECONCILE_MAX_BODY_BYTES = 16 * 1024

/** Minimum gap between successful reconciles on one plugin instance; each run pages the whole collection. */
const RECONCILE_COOLDOWN_MS = 60 * 1000

export function createSanityReconcileEndpoint({
  client,
  collectionSlug,
  path = '/sanity-storage/reconcile',
  access = defaultSanitySyncAccess,
  canUpdateMedia = async (req) =>
    canReconcileCollection((await getAccessResults({ req })) as never, collectionSlug),
}: CreateSanityReconcileEndpointArgs): Endpoint {
  // Per plugin instance: the endpoint closure holds the last successful run.
  let lastSuccessAt: number | null = null

  const handler: PayloadHandler = async (req) => {
    const t = req.t as SanityStorageTranslateFn

    if (!access({ req })) {
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiUnauthorized) },
        { status: 401 }
      )
    }

    const now = Date.now()
    if (lastSuccessAt != null && now - lastSuccessAt < RECONCILE_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RECONCILE_COOLDOWN_MS - (now - lastSuccessAt)) / 1000)
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiReconcileCooldown) },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      )
    }

    let dryRun = false
    let limit = 500
    let maxRows = RECONCILE_DEFAULT_MAX_ROWS
    let startPage = 1

    const bodyRead = await readWebhookRawBody(req, RECONCILE_MAX_BODY_BYTES)
    if (!bodyRead.ok && bodyRead.reason === 'too_large') {
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiWebhookInvalidPayload) },
        { status: 413 }
      )
    }
    const raw = bodyRead.ok ? bodyRead.rawBody : undefined
    if (raw?.trim()) {
      const parsed = parseJsonText(raw)
      const result = parsed == null ? null : v.safeParse(ReconcileBodySchema, parsed)
      const outOfRange = (value: number | undefined, max: number) =>
        value != null && (!Number.isInteger(value) || value < 1 || value > max)
      if (
        !result?.success ||
        (result.output.limit != null &&
          (!Number.isFinite(result.output.limit) || result.output.limit <= 0)) ||
        outOfRange(result.output.maxRows, RECONCILE_MAX_ROWS_CAP) ||
        outOfRange(result.output.page, Number.MAX_SAFE_INTEGER)
      ) {
        return Response.json(
          { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiWebhookInvalidPayload) },
          { status: 400 }
        )
      }
      dryRun = result.output.dryRun === true
      if (result.output.limit != null) {
        limit = Math.min(result.output.limit, RECONCILE_MAX_ROWS_CAP)
      }
      if (result.output.maxRows != null) maxRows = result.output.maxRows
      if (result.output.page != null) startPage = result.output.page
    }

    // Checked after the body is validated and before any upstream call.
    if (!(await canUpdateMedia(req))) {
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiUnauthorized) },
        { status: 403 }
      )
    }

    try {
      const report = await reconcileSanityMedia({
        payload: req.payload,
        client,
        collectionSlug,
        dryRun,
        limit,
        maxRows,
        startPage,
        req,
      })

      lastSuccessAt = Date.now()
      return Response.json(formatReconcileHttpResponse(report))
    } catch (error) {
      req.payload.logger?.error?.(
        `Sanity reconcile failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiReconcileFailed) },
        { status: 500 }
      )
    }
  }

  return {
    method: 'post',
    path,
    handler,
  }
}
