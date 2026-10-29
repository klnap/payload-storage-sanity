import type { CollectionBeforeOperationHook } from 'payload'

import { resolvePublicUrl } from '@/features/media/cdn'
import type { SanityMediaDocument } from '@/features/media/document'
import { requestWithoutUploadEdits } from '@/features/media/document'
import {
  getUploadEditsFromRequest,
  uploadEditsRequireBytesReupload,
} from '@/features/media/lifecycle/update'
import { getSanityAssetMetadata } from '@/sanity/assets'

/** Persists top-level `url` / dimensions before Payload fetches the file for crop (uses `originalDoc`). */
export function createSanityMediaEnsureCropSourceUrlBeforeOperationHook(options?: {
  cdnBaseUrl?: string
}): CollectionBeforeOperationHook {
  return async ({ args, collection, operation, req }) => {
    if (operation !== 'update') {
      return args
    }
    if (!getUploadEditsFromRequest(req)) {
      return args
    }
    if (!collection.upload) {
      return args
    }
    const rawId = 'id' in args ? (args as { id: unknown }).id : undefined
    if (rawId == null || rawId === '') {
      return args
    }
    if (typeof rawId !== 'string' && typeof rawId !== 'number') {
      return args
    }
    const id = rawId

    const doc = (await req.payload.findByID({
      collection: collection.slug,
      id,
      depth: 0,
      overrideAccess: true,
      req,
    })) as SanityMediaDocument | undefined

    if (!doc) {
      return args
    }

    if (
      !uploadEditsRequireBytesReupload(getUploadEditsFromRequest(req), {
        docWidth: doc.width,
        docHeight: doc.height,
      })
    ) {
      return args
    }

    const hasTopLevelUrl = typeof doc.url === 'string' && doc.url.trim().length > 0
    const widthOk = typeof doc.width === 'number' && doc.width > 0
    const heightOk = typeof doc.height === 'number' && doc.height > 0

    if (hasTopLevelUrl && widthOk && heightOk) {
      return args
    }

    const patch: Record<string, unknown> = {}
    if (!hasTopLevelUrl) {
      const publicUrl = resolvePublicUrl(doc, { cdnBaseUrl: options?.cdnBaseUrl })
      if (publicUrl) {
        patch.url = publicUrl
      }
    }

    const dimensions = getSanityAssetMetadata(doc)?.dimensions
    if (!widthOk && dimensions?.width != null) {
      patch.width = dimensions.width
    }
    if (!heightOk && dimensions?.height != null) {
      patch.height = dimensions.height
    }

    if (Object.keys(patch).length === 0) {
      return args
    }

    await req.payload.update({
      collection: collection.slug,
      id,
      data: patch as Record<string, unknown>,
      depth: 0,
      overrideAccess: true,
      context: {
        ...req.context,
        skipCloudStorage: true,
      },
      req: requestWithoutUploadEdits(req),
    })

    return args
  }
}
