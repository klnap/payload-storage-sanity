import type { CollectionBeforeDeleteHook } from 'payload'
import { APIError } from 'payload'

import { findMediaUsage } from '../queries/findMediaUsage'
import { formatMediaUsageBlockMessage } from '../utils/usageSummary'

/**
 * Blocks media deletion when any configured collection still references the row.
 * Runs before upstream Sanity asset cleanup hooks.
 */
export function createMediaReferenceIntegrityBeforeDeleteHook(
  mediaCollectionSlug: string
): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    if (req.context?.skipCloudStorage) return

    const usages = await findMediaUsage({
      config: req.payload.config,
      mediaCollectionSlug,
      mediaId: id,
      payload: req.payload,
      req,
      limitPerField: 1,
      stopOnFirstMatch: true,
    })

    if (usages.length === 0) {
      return
    }

    throw new APIError(formatMediaUsageBlockMessage(usages), 400, null, true)
  }
}
