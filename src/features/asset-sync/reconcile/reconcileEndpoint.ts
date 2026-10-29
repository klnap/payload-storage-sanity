import type { SanityClient } from '@sanity/client'
import type { Endpoint, PayloadHandler } from 'payload'
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
  reconcileSanityMedia,
} from '@/features/asset-sync'

export type CreateSanityReconcileEndpointArgs = {
  client: SanityClient
  collectionSlug: string
  path?: string
  access?: SanitySyncAccessFn
}

const ReconcileBodySchema = v.object({
  dryRun: v.optional(v.boolean()),
  limit: v.optional(v.number()),
})

export function createSanityReconcileEndpoint({
  client,
  collectionSlug,
  path = '/sanity-storage/reconcile',
  access = defaultSanitySyncAccess,
}: CreateSanityReconcileEndpointArgs): Endpoint {
  const handler: PayloadHandler = async (req) => {
    const t = req.t as SanityStorageTranslateFn

    if (!access({ req })) {
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiUnauthorized) },
        { status: 401 }
      )
    }

    let dryRun = false
    let limit = 500

    try {
      const raw = await req.text?.()
      const parsed = raw != null && raw.length > 0 ? parseJsonText(raw) : null
      const result = parsed != null ? v.safeParse(ReconcileBodySchema, parsed) : null
      if (result?.success) {
        if (result.output.dryRun === true) dryRun = true
        if (
          result.output.limit != null &&
          Number.isFinite(result.output.limit) &&
          result.output.limit > 0
        ) {
          limit = Math.min(result.output.limit, 5000)
        }
      }
    } catch {
      // Empty body is valid — run a full reconcile with defaults.
    }

    try {
      const report = await reconcileSanityMedia({
        payload: req.payload,
        client,
        collectionSlug,
        dryRun,
        limit,
        req,
      })

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
