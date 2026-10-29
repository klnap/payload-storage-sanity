import { APIError, type Endpoint, type PayloadHandler } from 'payload'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'
import { defaultSanitySyncAccess, type SanitySyncAccessFn } from '@/features/asset-sync'

export type CreateMediaUsageEndpointArgs = {
  mediaCollectionSlug: string
  /** Default: Payload admin auth collection only (same as reconcile). */
  access?: SanitySyncAccessFn
}

export function createMediaUsageEndpoint({
  mediaCollectionSlug,
  access = defaultSanitySyncAccess,
}: CreateMediaUsageEndpointArgs): Endpoint {
  const handler: PayloadHandler = async (req) => {
    const t = req.t as SanityStorageTranslateFn

    if (!access({ req })) {
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiUnauthorized) },
        { status: 401 }
      )
    }

    // SAFETY: routeParams.id is a string or number parameter provided by the router
    let rawId = req.routeParams?.id as string | number | undefined

    if (rawId == null || rawId === '') {
      if (req.query?.id) {
        rawId = String(req.query.id)
      } else if (req.url) {
        try {
          const segments = new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean)
          const usageIdx = segments.lastIndexOf('usage')
          if (usageIdx > 0) {
            rawId = segments[usageIdx - 1]
          }
        } catch {
          // ignore
        }
      }
    }

    if (rawId == null || rawId === '') {
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiMissingMediaId) },
        { status: 400 }
      )
    }

    const mediaId = /^\d+$/.test(String(rawId)) ? Number(rawId) : String(rawId)

    try {
      await req.payload.findByID({
        collection: mediaCollectionSlug,
        id: mediaId,
        depth: 0,
        req,
      })
    } catch (error) {
      if (error instanceof APIError) {
        const status = error.status ?? 403
        const messageKey =
          status === 404
            ? SANITY_STORAGE_I18N_KEYS.apiNotFound
            : SANITY_STORAGE_I18N_KEYS.apiForbidden
        return Response.json({ error: sanityStorageTranslate(t, messageKey) }, { status })
      }
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiNotFound) },
        { status: 404 }
      )
    }

    try {
      const { findMediaUsage } = await import('@/features/media/usage/scan/findMediaUsage')
      const usages = await findMediaUsage({
        config: req.payload.config,
        mediaCollectionSlug,
        mediaId,
        payload: req.payload,
        req,
      })

      return Response.json({ usages })
    } catch (err) {
      req.payload.logger?.error?.(
        `Failed to find media usage: ${err instanceof Error ? err.message : String(err)}`
      )
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiMediaUsageFailed) },
        { status: 500 }
      )
    }
  }

  return {
    method: 'get',
    path: '/:id/usage',
    handler,
  }
}
