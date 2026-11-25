import type { PayloadRequest } from 'payload'

export function hasIncomingUploadSizes(req: PayloadRequest): boolean {
  const sizes = req.payloadUploadSizes
  if (!sizes) return false
  return Object.values(sizes).some((buffer) => buffer != null && buffer.length > 0)
}

export function clearStaleCloudStorageUploadContext(req: PayloadRequest): void {
  req.file = undefined
  req.payloadUploadSizes = undefined

  const context = req.context as Record<string, unknown> | undefined
  if (context?._payloadCloudStorage) {
    delete context._payloadCloudStorage
  }
}

/**
 * Runs last in `beforeChange`: keeps upstream Sanity fields on metadata-only saves and
 * prevents cloud-storage from re-uploading when no new file bytes are present.
 */
export function requestWithoutUploadEdits(req: PayloadRequest): PayloadRequest {
  if (req.query?.uploadEdits == null) {
    return req
  }
  const query = { ...req.query }
  delete query.uploadEdits
  return { ...req, query }
}
