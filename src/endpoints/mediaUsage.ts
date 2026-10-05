import { APIError, type Endpoint, type PayloadHandler } from 'payload'

export type CreateMediaUsageEndpointArgs = {
  mediaCollectionSlug: string
}

export function createMediaUsageEndpoint({
  mediaCollectionSlug,
}: CreateMediaUsageEndpointArgs): Endpoint {
  const handler: PayloadHandler = async (req) => {
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
      return Response.json({ error: 'Missing media id' }, { status: 400 })
    }

    const mediaId = /^\d+$/.test(String(rawId)) ? Number(rawId) : String(rawId)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      await req.payload.findByID({
        collection: mediaCollectionSlug,
        id: mediaId,
        depth: 0,
        req,
      })
    } catch (error) {
      if (error instanceof APIError) {
        return Response.json(
          { error: error.message || 'Forbidden' },
          { status: error.status }
        )
      }
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    try {
      const { findMediaUsage } = await import('../queries/findMediaUsage')
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
      return Response.json({ error: 'Failed to find media usage' }, { status: 500 })
    }
  }

  return {
    method: 'get',
    path: '/:id/usage',
    handler,
  }
}
