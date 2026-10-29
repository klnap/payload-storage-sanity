import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import type { SanityStorageUploadMaxSizeInput, SanityUploadMediaKind } from '@/core/config'
import {
  classifyUploadMediaKind,
  formatBytesForMessage,
  mergeUploadMaxSizeConfig,
  resolveUploadMaxSizeBytes,
  uploadMaxSizeConfigHasLimits,
} from '@/core/config'
import type { SanityStorageTranslateFn } from '@/core/i18n'
import { SANITY_STORAGE_I18N_KEYS, sanityStorageTranslate } from '@/core/i18n'
import { readUploadBufferFromRequest } from '@/features/media/lifecycle/dedupe'

function uploadKindLabel(t: SanityStorageTranslateFn, kind: SanityUploadMediaKind): string {
  switch (kind) {
    case 'image':
      return sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.uploadKindImage)
    case 'video':
      return sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.uploadKindVideo)
    default:
      return sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.uploadKindFile)
  }
}

/** Server hook only — no `node:fs` (Payload config is analyzed for admin client bundles). */
function incomingUploadByteSize(req: PayloadRequest): number | null {
  const file = req.file
  if (!file) {
    return null
  }

  if (typeof file.size === 'number' && file.size > 0) {
    return file.size
  }

  if (file.data?.length) {
    return file.data.length
  }

  return null
}

function hasIncomingUploadSizes(req: {
  payloadUploadSizes?: Record<string, Buffer | undefined>
}): boolean {
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

    let byteSize = incomingUploadByteSize(req)
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
      throw new APIError(
        sanityStorageTranslate(
          req.t as SanityStorageTranslateFn,
          SANITY_STORAGE_I18N_KEYS.uploadMaxSizeExceeded,
          {
            kindLabel: uploadKindLabel(req.t as SanityStorageTranslateFn, kind),
            actualSize: formatBytesForMessage(byteSize),
            limitSize: formatBytesForMessage(limit),
          }
        ),
        400,
        null,
        true
      )
    }

    return data
  }
}
