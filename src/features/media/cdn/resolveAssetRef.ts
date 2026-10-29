import * as v from 'valibot'
import { isPayloadDocumentId, type PayloadDocumentId } from '@/core/contracts'
import type { SanityMediaDocument } from '@/features/media/document/sanityStorageDocument'
import type { SanityAssetReference } from '@/sanity/assets'
import { getSanityAssetId } from '@/sanity/assets'

export type SanityUploadReference =
  | string
  | number
  | SanityAssetReference
  | SanityMediaDocument
  | {
      sanity?: { asset?: { _id?: string | null } | null } | null
      _ref?: string | null
      id?: PayloadDocumentId | null
    }
  | null
  | undefined

export function resolveImageFileRef(upload: SanityUploadReference): string | null {
  if (upload == null) return null

  if (v.is(v.string(), upload)) {
    return upload.trim().length > 0 ? upload : null
  }

  if (v.is(v.number(), upload)) {
    return null
  }

  if ('_ref' in upload && upload._ref && upload._ref.trim().length > 0) {
    return upload._ref
  }

  const fromDoc = getSanityAssetId(upload as SanityMediaDocument)
  if (fromDoc) {
    return fromDoc
  }

  return null
}

export function resolveMediaId(upload: SanityUploadReference): PayloadDocumentId | null {
  if (upload == null) return null

  if (v.is(v.number(), upload)) {
    return Number.isFinite(upload) ? upload : null
  }

  if (v.is(v.string(), upload)) {
    if (/^\d+$/.test(upload)) {
      return Number(upload)
    }
    return isPayloadDocumentId(upload) ? upload : null
  }

  if ('id' in upload && isPayloadDocumentId(upload.id)) {
    if (typeof upload.id === 'string' && /^\d+$/.test(upload.id)) {
      return Number(upload.id)
    }
    return upload.id
  }

  return null
}
