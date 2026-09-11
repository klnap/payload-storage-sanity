import { createReadStream } from 'node:fs'
import type { Readable } from 'node:stream'

export type UploadFilePayload = {
  buffer?: Buffer
  data?: Buffer | Uint8Array | number[]
  tempFilePath?: string
  filename?: string
  mimeType?: string
}

export function resolveSanityUploadBody(file: UploadFilePayload): Buffer | Readable {
  if (file.buffer && file.buffer.length > 0) {
    return file.buffer
  }

  if (file.data) {
    if (Buffer.isBuffer(file.data) && file.data.length > 0) {
      return file.data
    }
    if (Array.isArray(file.data)) {
      return Buffer.from(file.data)
    }
    if (file.data instanceof Uint8Array) {
      return Buffer.from(file.data)
    }
  }

  if (file.tempFilePath) {
    return createReadStream(file.tempFilePath)
  }

  return Buffer.alloc(0)
}

const IMAGE_EXTENSIONS = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
} as const

const FILE_EXTENSIONS = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  zip: 'application/zip',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  txt: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
} as const

type ImageExtension = keyof typeof IMAGE_EXTENSIONS
type FileExtension = keyof typeof FILE_EXTENSIONS

function isImageExtension(ext: string): ext is ImageExtension {
  return Object.hasOwn(IMAGE_EXTENSIONS, ext)
}

function isFileExtension(ext: string): ext is FileExtension {
  return Object.hasOwn(FILE_EXTENSIONS, ext)
}

/** Determines if an upload is an image processed by Sanity's image pipeline. */
export function isImageFileType(mimeType?: string, filename?: string): boolean {
  if (mimeType?.startsWith('image/')) {
    return true
  }

  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext && isImageExtension(ext)) {
      return true
    }
  }

  return false
}

/** Resolves the target Sanity asset category ('image' for image pipeline, 'file' for general files). */
export function resolveSanityAssetType(mimeType?: string, filename?: string): 'image' | 'file' {
  return isImageFileType(mimeType, filename) ? 'image' : 'file'
}

/** Resolves normalized MIME type for both image and general file uploads. */
export function normalizeAssetMimeType(
  mimeType: string | undefined,
  filename: string | undefined
): string {
  if (mimeType && mimeType !== 'application/octet-stream' && mimeType !== '') {
    return mimeType
  }

  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext) {
      if (isImageExtension(ext)) return IMAGE_EXTENSIONS[ext]
      if (isFileExtension(ext)) return FILE_EXTENSIONS[ext]
    }
  }

  if (mimeType === 'application/octet-stream') {
    return 'application/octet-stream'
  }

  return isImageFileType(mimeType, filename) ? 'image/jpeg' : 'application/octet-stream'
}

export function normalizeImageMimeType(
  mimeType: string | undefined,
  filename: string | undefined
): string {
  return normalizeAssetMimeType(mimeType, filename)
}
