import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { isUnsetSyncStatus, readMediaSync } from '@/features/asset-sync'
import type { SanityMediaDocument, SanityPersistedAssetGroup } from '@/features/media/document'
import {
  clearStaleCloudStorageUploadContext,
  hasIncomingUploadSizes,
  mergeSanityGroupOnUpdate,
} from '@/features/media/document'
import {
  isCloudStorageUpstreamMetadataUpdate,
  isFocalOnlyUploadEdits,
  uploadEditsRequireBytesReuploadFromRequest,
} from '@/features/media/lifecycle/update'

export const SANITY_MEDIA_REPROCESS_CONTEXT_KEY = 'sanityMediaReprocessed' as const

export function createSanityMediaPersistUpstreamBeforeChangeHook(): CollectionBeforeChangeHook {
  return ({ data, operation, originalDoc, req }) => {
    if (!data || operation !== 'update') {
      return data
    }

    if (isCloudStorageUpstreamMetadataUpdate(req, data)) {
      return data
    }

    const focalOnly = isFocalOnlyUploadEdits(req, { data, originalDoc })
    const bytesReprocess = uploadEditsRequireBytesReuploadFromRequest(req, {
      data,
      originalDoc,
    })
    const hasNewBytes = Boolean(req.file?.data?.length)
    const hasSizes = hasIncomingUploadSizes(req)
    let hasIncomingFile = hasNewBytes || hasSizes || bytesReprocess

    if (focalOnly) {
      hasIncomingFile = false
    }

    if (!hasIncomingFile) {
      clearStaleCloudStorageUploadContext(req)
      if (!req.context) {
        req.context = {}
      }
      req.context.skipCloudStorage = true
    } else {
      if (!req.context) {
        req.context = {}
      }
      req.context[SANITY_MEDIA_REPROCESS_CONTEXT_KEY] = true

      const ctx = req.context as { _payloadCloudStorage?: { file?: PayloadRequest['file'] } }
      if (!hasNewBytes && ctx?._payloadCloudStorage?.file?.data?.length) {
        req.file = ctx._payloadCloudStorage.file
      }
    }

    const previous = originalDoc as SanityMediaDocument | undefined
    if (!previous) {
      return data
    }

    let next = data as SanityMediaDocument

    if (!hasIncomingFile) {
      const mergedSanity = mergeSanityGroupOnUpdate(
        data.sanity as SanityPersistedAssetGroup | undefined,
        previous.sanity
      )

      if (mergedSanity) {
        next = { ...next, sanity: mergedSanity }
      }

      const scalarFileFields = ['filename', 'focalX', 'focalY', 'prefix'] as const
      for (const key of scalarFileFields) {
        const nextVal = next[key]
        const prevVal = previous[key]
        if ((nextVal == null || nextVal === '') && prevVal != null && prevVal !== '') {
          next = { ...next, [key]: prevVal }
        }
      }
    }

    if (
      isUnsetSyncStatus(data.sync?.status) &&
      previous.sync?.status != null &&
      !isUnsetSyncStatus(previous.sync.status)
    ) {
      next = {
        ...next,
        sync: {
          ...readMediaSync(previous),
          ...readMediaSync(next),
          status: previous.sync.status,
        },
      }
    }

    return next as typeof data
  }
}
