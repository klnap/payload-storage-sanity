export type MediaType = 'image' | 'video' | 'audio' | 'file'
export type MediaRole = 'asset' | 'poster'

export type MediaClassification = {
  mediaType: MediaType
  mimeType: string
  browserPlaybackSupported: boolean
  imageTransformationSupported: boolean
  role: MediaRole
}

const EXTENSION_TYPES: Record<string, { mediaType: MediaType; mimeType: string }> = {
  avif: { mediaType: 'image', mimeType: 'image/avif' },
  bmp: { mediaType: 'image', mimeType: 'image/bmp' },
  gif: { mediaType: 'image', mimeType: 'image/gif' },
  heic: { mediaType: 'image', mimeType: 'image/heic' },
  heif: { mediaType: 'image', mimeType: 'image/heif' },
  ico: { mediaType: 'image', mimeType: 'image/x-icon' },
  jpeg: { mediaType: 'image', mimeType: 'image/jpeg' },
  jpg: { mediaType: 'image', mimeType: 'image/jpeg' },
  png: { mediaType: 'image', mimeType: 'image/png' },
  svg: { mediaType: 'image', mimeType: 'image/svg+xml' },
  tif: { mediaType: 'image', mimeType: 'image/tiff' },
  tiff: { mediaType: 'image', mimeType: 'image/tiff' },
  webp: { mediaType: 'image', mimeType: 'image/webp' },
  avi: { mediaType: 'video', mimeType: 'video/x-msvideo' },
  m4v: { mediaType: 'video', mimeType: 'video/mp4' },
  mkv: { mediaType: 'video', mimeType: 'video/x-matroska' },
  mov: { mediaType: 'video', mimeType: 'video/quicktime' },
  mp4: { mediaType: 'video', mimeType: 'video/mp4' },
  mpeg: { mediaType: 'video', mimeType: 'video/mpeg' },
  mpg: { mediaType: 'video', mimeType: 'video/mpeg' },
  webm: { mediaType: 'video', mimeType: 'video/webm' },
  wmv: { mediaType: 'video', mimeType: 'video/x-ms-wmv' },
  mp3: { mediaType: 'audio', mimeType: 'audio/mpeg' },
  m4a: { mediaType: 'audio', mimeType: 'audio/mp4' },
  aac: { mediaType: 'audio', mimeType: 'audio/aac' },
  flac: { mediaType: 'audio', mimeType: 'audio/flac' },
  oga: { mediaType: 'audio', mimeType: 'audio/ogg' },
  ogg: { mediaType: 'audio', mimeType: 'audio/ogg' },
  opus: { mediaType: 'audio', mimeType: 'audio/opus' },
  wav: { mediaType: 'audio', mimeType: 'audio/wav' },
  pdf: { mediaType: 'file', mimeType: 'application/pdf' },
  doc: { mediaType: 'file', mimeType: 'application/msword' },
  docx: {
    mediaType: 'file',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  xls: { mediaType: 'file', mimeType: 'application/vnd.ms-excel' },
  xlsx: {
    mediaType: 'file',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  csv: { mediaType: 'file', mimeType: 'text/csv' },
  zip: { mediaType: 'file', mimeType: 'application/zip' },
  tar: { mediaType: 'file', mimeType: 'application/x-tar' },
  gz: { mediaType: 'file', mimeType: 'application/gzip' },
  rar: { mediaType: 'file', mimeType: 'application/vnd.rar' },
  '7z': { mediaType: 'file', mimeType: 'application/x-7z-compressed' },
  txt: { mediaType: 'file', mimeType: 'text/plain' },
  json: { mediaType: 'file', mimeType: 'application/json' },
  xml: { mediaType: 'file', mimeType: 'application/xml' },
}

const MIME_TYPES: Record<string, MediaType> = Object.fromEntries(
  Object.values(EXTENSION_TYPES).map((value) => [value.mimeType, value.mediaType])
)

const ZIP_BASED_DOCUMENT_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

function classifySignature(
  bytes?: Uint8Array
): { mediaType: MediaType; mimeType: string; ambiguousMp4?: boolean } | null {
  if (!bytes || bytes.length === 0) return null
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  if (starts(0xff, 0xd8, 0xff)) return { mediaType: 'image', mimeType: 'image/jpeg' }
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { mediaType: 'image', mimeType: 'image/png' }
  if (starts(0x47, 0x49, 0x46, 0x38)) return { mediaType: 'image', mimeType: 'image/gif' }
  if (starts(0x42, 0x4d)) return { mediaType: 'image', mimeType: 'image/bmp' }
  if (starts(0x00, 0x00, 0x01, 0x00)) return { mediaType: 'image', mimeType: 'image/x-icon' }
  if (starts(0x49, 0x49, 0x2a, 0x00) || starts(0x4d, 0x4d, 0x00, 0x2a))
    return { mediaType: 'image', mimeType: 'image/tiff' }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  )
    return { mediaType: 'image', mimeType: 'image/webp' }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp') {
    const brand = String.fromCharCode(...bytes.subarray(8, 12))
    if (brand === 'avif' || brand === 'avis') return { mediaType: 'image', mimeType: 'image/avif' }
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand))
      return { mediaType: 'image', mimeType: 'image/heic' }
    if (['M4A ', 'M4B ', 'M4P ', 'F4A ', 'F4B '].includes(brand))
      return { mediaType: 'audio', mimeType: 'audio/mp4' }
    return {
      mediaType: 'video',
      mimeType: brand === 'qt  ' ? 'video/quicktime' : 'video/mp4',
      ...(['isom', 'iso2', 'mp41', 'mp42'].includes(brand) ? { ambiguousMp4: true } : undefined),
    }
  }
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return { mediaType: 'video', mimeType: 'video/webm' }
  if (String.fromCharCode(...bytes.subarray(0, 3)) === 'ID3')
    return { mediaType: 'audio', mimeType: 'audio/mpeg' }
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)
    return { mediaType: 'audio', mimeType: 'audio/mpeg' }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF') {
    const format = String.fromCharCode(...bytes.subarray(8, 12))
    if (format === 'WAVE') return { mediaType: 'audio', mimeType: 'audio/wav' }
  }
  if (starts(0x4f, 0x67, 0x67, 0x53)) return { mediaType: 'audio', mimeType: 'audio/ogg' }
  if (starts(0x66, 0x4c, 0x61, 0x43)) return { mediaType: 'audio', mimeType: 'audio/flac' }
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d))
    return { mediaType: 'file', mimeType: 'application/pdf' }
  if (starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06))
    return { mediaType: 'file', mimeType: 'application/zip' }
  return null
}

function extensionHint(filename?: string) {
  const extension = filename?.split('.').pop()?.toLowerCase()
  return extension ? EXTENSION_TYPES[extension] : undefined
}

/** Classifies media hints and a bounded file signature; this is not a security validator. */
export function classifyMedia(
  input: { mimeType?: string; filename?: string; signature?: Uint8Array; role?: MediaRole } = {}
): MediaClassification {
  const signature = classifySignature(input.signature?.subarray(0, 32))
  const declaredMime = input.mimeType?.split(';', 1)[0]?.trim().toLowerCase()
  const declaredType = declaredMime ? MIME_TYPES[declaredMime] : undefined
  const extension = extensionHint(input.filename)
  const audioMp4Extension = extension?.mediaType === 'audio' && extension.mimeType === 'audio/mp4'
  const mediaType =
    signature?.ambiguousMp4 && audioMp4Extension
      ? 'audio'
      : (signature?.mediaType ?? declaredType ?? extension?.mediaType ?? 'file')
  const signatureMimeType =
    signature?.ambiguousMp4 && audioMp4Extension ? 'audio/mp4' : signature?.mimeType
  const mimeType =
    (signatureMimeType === 'application/zip'
      ? ((declaredMime && ZIP_BASED_DOCUMENT_MIME_TYPES.has(declaredMime)
          ? declaredMime
          : undefined) ??
        (!declaredType &&
        extension?.mediaType === 'file' &&
        ZIP_BASED_DOCUMENT_MIME_TYPES.has(extension.mimeType)
          ? extension.mimeType
          : signatureMimeType))
      : signatureMimeType) ??
    (declaredType === mediaType && declaredMime ? declaredMime : undefined) ??
    (extension?.mediaType === mediaType ? extension.mimeType : undefined) ??
    (mediaType === 'file' ? declaredMime : undefined) ??
    'application/octet-stream'

  return {
    mediaType,
    mimeType,
    browserPlaybackSupported:
      mediaType === 'video'
        ? ['video/mp4', 'video/webm'].includes(mimeType)
        : mediaType === 'audio'
          ? ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/aac'].includes(mimeType)
          : false,
    imageTransformationSupported:
      mediaType === 'image' && mimeType !== 'image/svg+xml' && mimeType !== 'image/x-icon',
    role: mediaType === 'image' && input.role === 'poster' ? 'poster' : 'asset',
  }
}
