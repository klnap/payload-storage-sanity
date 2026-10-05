import * as v from 'valibot'

import type { SanityAssetReference } from '../types/asset'
import type { SanityMediaDocument } from '../types/sanityStorageDocument'
import { isPayloadDocumentId, type PayloadDocumentId } from './payloadDocumentId'

export type SanityUploadReference =
  | string
  | number
  | SanityAssetReference
  | SanityMediaDocument
  | {
      sanity?: { id?: string | null } | null
      sanityAssetId?: string | null
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
  if ('sanity' in upload && upload.sanity?.id && upload.sanity.id.trim().length > 0) {
    return upload.sanity.id
  }
  if ('sanityAssetId' in upload && upload.sanityAssetId && upload.sanityAssetId.trim().length > 0) {
    return upload.sanityAssetId
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
