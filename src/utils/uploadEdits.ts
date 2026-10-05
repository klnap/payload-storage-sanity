import type { PayloadRequest } from 'payload'

export type UploadEditsQuery = {
  crop?: unknown
  widthInPixels?: unknown
  heightInPixels?: unknown
  focalPoint?: { x?: unknown; y?: unknown }
}

export function getUploadEditsFromRequest(req: PayloadRequest): UploadEditsQuery | undefined {
  const raw = req.query?.uploadEdits
  if (raw == null || typeof raw !== 'object') {
    return undefined
  }
  return raw as UploadEditsQuery
}

/** Payload admin crop / resize / focal reprocess (query `uploadEdits`). */
export function hasUploadEditsOnRequest(req: PayloadRequest): boolean {
  const edits = getUploadEditsFromRequest(req)
  if (!edits) {
    return false
  }
  if (edits.crop != null || edits.widthInPixels != null || edits.heightInPixels != null) {
    return true
  }
  return edits.focalPoint != null
}

export function isAdapterSanityMetadataPatch(data: {
  sanity?: { id?: string | null; path?: string | null; rev?: string | null } | null
}): boolean {
  const sanity = data.sanity
  if (sanity == null || typeof sanity !== 'object') {
    return false
  }
  return Boolean(sanity.id?.trim() || sanity.path?.trim() || sanity.rev?.trim())
}

/** Cloud-storage nested `update` after `handleUpload` (must not merge stale upstream). */
export function isCloudStorageUpstreamMetadataUpdate(
  req: PayloadRequest,
  data: { sanity?: { id?: string | null } | null }
): boolean {
  return Boolean(req.context?.skipCloudStorage) && isAdapterSanityMetadataPatch(data)
}
