import type { CollectionBeforeDeleteHook } from 'payload'
import { APIError } from 'payload'

import { findMediaUsage } from '../queries/findMediaUsage'
import { readSanityStorageContext } from '../populate/requestContext'
import {
  formatMediaUsageBlockMessage,
  formatMediaUsageCompactDeleteMessage,
  resolveMediaDeleteLabel,
  summarizeMediaUsage,
} from '../utils/usageSummary'
import { MEDIA_REFERENCED_ERROR_CODE } from './mediaDeleteAfterOperation'

export type MediaReferencedErrorData = {
  code: typeof MEDIA_REFERENCED_ERROR_CODE
  mediaId: number | string
  referenceCount: number
}

/**
 * Blocks media deletion when any configured collection still references the row.
 * Runs before upstream Sanity asset cleanup hooks.
 */
export function createMediaReferenceIntegrityBeforeDeleteHook(
  mediaCollectionSlug: string
): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    if (req.context?.skipCloudStorage) return

    let usages
    try {
      usages = await findMediaUsage({
        config: req.payload.config,
        mediaCollectionSlug,
        mediaId: id,
        payload: req.payload,
        req,
        limitPerField: 1,
        stopOnFirstMatch: true,
      })
    } catch (err) {
      req.payload.logger.error(err)
      throw new APIError(
        'Could not verify whether this media asset is still referenced.',
        400,
        null,
        true
      )
    }

    if (usages.length === 0) {
      return
    }

    const referenceCount = summarizeMediaUsage(usages).totalDistinctDocuments
    const bulkDelete = readSanityStorageContext(req.context)?.bulkDelete === true

    if (bulkDelete) {
      const doc = await req.payload.findByID({
        collection: mediaCollectionSlug,
        id,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })

      const label = resolveMediaDeleteLabel(
        doc as { filename?: string | null; name?: string | null } | null,
        id
      )
      const message = formatMediaUsageCompactDeleteMessage(label, usages)

      throw new APIError(message, 400, {
        code: MEDIA_REFERENCED_ERROR_CODE,
        mediaId: id,
        referenceCount,
      } satisfies MediaReferencedErrorData, true)
    }

    throw new APIError(formatMediaUsageBlockMessage(usages), 400, null, true)
  }
}
