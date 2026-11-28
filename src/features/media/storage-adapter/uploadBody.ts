import { createReadStream } from 'node:fs'
import { open } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import { classifyMedia } from '@/core/config'

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

export { isImageFileType } from '@/core/config'

/** Resolves the target Sanity asset category ('image' for image pipeline, 'file' for general files). */
export function resolveSanityAssetType(mimeType?: string, filename?: string): 'image' | 'file' {
  return classifyMedia({ mimeType, filename }).mediaType === 'image' ? 'image' : 'file'
}

export async function readUploadSignature(
  file: UploadFilePayload
): Promise<Uint8Array | undefined> {
  const bytes = file.buffer?.length ? file.buffer : file.data
  if (bytes instanceof Uint8Array && bytes.length > 0) return bytes.subarray(0, 32)
  if (Array.isArray(bytes) && bytes.length > 0) return Uint8Array.from(bytes.slice(0, 32))
  if (!file.tempFilePath) return undefined
  const handle = await open(file.tempFilePath, 'r')
  try {
    const signature = new Uint8Array(32)
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0)
    return signature.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export function normalizeAssetMimeType(mimeType: string | undefined, filename: string | undefined) {
  return classifyMedia({ mimeType, filename }).mimeType
}

export function normalizeImageMimeType(
  mimeType: string | undefined,
  filename: string | undefined
): string {
  return normalizeAssetMimeType(mimeType, filename)
}
