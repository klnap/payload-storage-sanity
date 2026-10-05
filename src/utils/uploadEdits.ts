import type { PayloadRequest } from 'payload'

export type UploadEditsQuery = {
  crop?: unknown
  widthInPixels?: unknown
  heightInPixels?: unknown
  focalPoint?: { x?: unknown; y?: unknown }
}

export type UploadEditsBytesContext = {
  docWidth?: number | null
  docHeight?: number | null
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function getUploadEditsFromRequest(req: PayloadRequest): UploadEditsQuery | undefined {
  const raw = req.query?.uploadEdits
  if (raw == null || typeof raw !== 'object') {
    return undefined
  }
  return raw as UploadEditsQuery
}

/** Payload admin sent `uploadEdits` on the request (crop modal save, etc.). */
export function hasUploadEditsOnRequest(req: PayloadRequest): boolean {
  return getUploadEditsFromRequest(req) != null
}

/** Admin default crop when only adjusting focal (Payload EditUpload always includes crop). */
export function isDefaultFullCrop(
  crop: unknown,
  ctx?: UploadEditsBytesContext
): boolean {
  if (crop == null) {
    return true
  }
  if (typeof crop !== 'object') {
    return false
  }

  const c = crop as {
    unit?: string
    x?: unknown
    y?: unknown
    width?: unknown
    height?: unknown
  }
  const unit = c.unit ?? '%'

  if (unit === '%') {
    const x = toFiniteNumber(c.x) ?? 0
    const y = toFiniteNumber(c.y) ?? 0
    const width = toFiniteNumber(c.width) ?? 100
    const height = toFiniteNumber(c.height) ?? 100
    return x === 0 && y === 0 && width === 100 && height === 100
  }

  if (unit === 'px') {
    const docWidth = toFiniteNumber(ctx?.docWidth)
    const docHeight = toFiniteNumber(ctx?.docHeight)
    if (docWidth == null || docHeight == null) {
      return false
    }
    const x = toFiniteNumber(c.x) ?? 0
    const y = toFiniteNumber(c.y) ?? 0
    const width = toFiniteNumber(c.width) ?? docWidth
    const height = toFiniteNumber(c.height) ?? docHeight
    return x === 0 && y === 0 && width === docWidth && height === docHeight
  }

  return false
}

/** True when admin uploadEdits imply fetch/reprocess bytes (crop or resize), not focal-only metadata. */
export function uploadEditsRequireBytesReupload(
  edits: UploadEditsQuery | undefined,
  ctx?: UploadEditsBytesContext
): boolean {
  if (!edits) {
    return false
  }

  if (edits.crop != null && !isDefaultFullCrop(edits.crop, ctx)) {
    return true
  }

  const docWidth = toFiniteNumber(ctx?.docWidth)
  const docHeight = toFiniteNumber(ctx?.docHeight)
  const widthInPixels = toFiniteNumber(edits.widthInPixels)
  const heightInPixels = toFiniteNumber(edits.heightInPixels)

  if (widthInPixels != null && docWidth != null && widthInPixels !== docWidth) {
    return true
  }
  if (heightInPixels != null && docHeight != null && heightInPixels !== docHeight) {
    return true
  }

  return false
}

export function resolveUploadEditsBytesContext(args: {
  data?: { width?: unknown; height?: unknown } | null
  originalDoc?: { width?: unknown; height?: unknown } | null
  docWidth?: number | null
  docHeight?: number | null
}): UploadEditsBytesContext {
  return {
    docWidth:
      toFiniteNumber(args.docWidth) ??
      toFiniteNumber(args.data?.width) ??
      toFiniteNumber(args.originalDoc?.width),
    docHeight:
      toFiniteNumber(args.docHeight) ??
      toFiniteNumber(args.data?.height) ??
      toFiniteNumber(args.originalDoc?.height),
  }
}

export function uploadEditsRequireBytesReuploadFromRequest(
  req: PayloadRequest,
  args: {
    data?: { width?: unknown; height?: unknown } | null
    originalDoc?: { width?: unknown; height?: unknown } | null
  } = {}
): boolean {
  const ctx = resolveUploadEditsBytesContext(args)
  return uploadEditsRequireBytesReupload(getUploadEditsFromRequest(req), ctx)
}

/** Edit-upload save that only updates focal (or noop default crop); must not call Sanity upload. */
export function isFocalOnlyUploadEdits(
  req: PayloadRequest,
  args: {
    data?: { width?: unknown; height?: unknown } | null
    originalDoc?: { width?: unknown; height?: unknown } | null
  } = {}
): boolean {
  if (!getUploadEditsFromRequest(req)) {
    return false
  }
  return !uploadEditsRequireBytesReuploadFromRequest(req, args)
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
