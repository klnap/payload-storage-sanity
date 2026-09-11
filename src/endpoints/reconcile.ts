import type { SanityClient } from '@sanity/client'
import type { Endpoint, PayloadHandler } from 'payload'
import * as v from 'valibot'

import { reconcileSanityMedia } from '../sync/reconcile'
import { parseJsonText } from '../utils/json'

export type CreateSanityReconcileEndpointArgs = {
  client: SanityClient
  collectionSlug: string
  path?: string
}

const ReconcileBodySchema = v.object({
  dryRun: v.optional(v.boolean()),
  limit: v.optional(v.number()),
})

export function createSanityReconcileEndpoint({
  client,
  collectionSlug,
  path = '/sanity/reconcile',
}: CreateSanityReconcileEndpointArgs): Endpoint {
  const handler: PayloadHandler = async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
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

      return Response.json(report)
    } catch (error) {
      req.payload.logger?.error?.(
        `Sanity reconcile failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return Response.json({ error: 'Reconcile failed' }, { status: 500 })
    }
  }

  return {
    method: 'post',
    path,
    handler,
  }
}
