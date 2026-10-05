import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

import { readUploadBufferFromRequest } from './dedupeUpload'
import type { SanityStorageUploadMaxSizeInput } from '../utils/uploadMaxSize'
import {
  classifyUploadMediaKind,
  formatUploadMaxSizeError,
  mergeUploadMaxSizeConfig,
  resolveIncomingUploadByteSize,
  resolveUploadMaxSizeBytes,
  uploadMaxSizeConfigHasLimits,
} from '../utils/uploadMaxSize'

function hasIncomingUploadSizes(req: { payloadUploadSizes?: Record<string, Buffer | undefined> }): boolean {
  const sizes = req.payloadUploadSizes
  if (!sizes) return false
  return Object.values(sizes).some((buffer) => buffer != null && buffer.length > 0)
}

export type CreateSanityMediaUploadMaxSizeBeforeChangeHookArgs = {
  plugin?: SanityStorageUploadMaxSizeInput
  collection?: SanityStorageUploadMaxSizeInput
}

export function createSanityMediaUploadMaxSizeBeforeChangeHook({
  plugin,
  collection,
}: CreateSanityMediaUploadMaxSizeBeforeChangeHookArgs): CollectionBeforeChangeHook {
  const merged = mergeUploadMaxSizeConfig(plugin, collection)

  if (!uploadMaxSizeConfigHasLimits(merged)) {
    return ({ data }) => data
  }

  return async ({ data, operation, req }) => {
    if (operation !== 'create' && operation !== 'update') {
      return data
    }

    const hasSizes = hasIncomingUploadSizes(req)
    const buffer = readUploadBufferFromRequest(req)
    if (!req.file && !buffer && !hasSizes) {
      return data
    }

    let byteSize = await resolveIncomingUploadByteSize(req)
    if (byteSize == null && buffer?.length) {
      byteSize = buffer.length
    }

    if (byteSize == null || byteSize <= 0) {
      return data
    }

    const mimeType = req.file?.mimetype
    const filename = req.file?.name
    const kind = classifyUploadMediaKind(mimeType, filename)
    const limit = resolveUploadMaxSizeBytes(kind, merged)

    if (limit == null) {
      return data
    }

    if (byteSize > limit) {
      throw new APIError(formatUploadMaxSizeError(kind, byteSize, limit), 400, null, true)
    }

    return data
  }
}
