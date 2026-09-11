import * as v from 'valibot'

import type { SanityAssetReference } from '../types/asset'
import type { SanityMediaAsset } from '../types/image'

export type SanityUploadReference =
  | string
  | number
  | SanityAssetReference
  | SanityMediaAsset
  | {
      sanity_id?: string | null
      sanityAssetId?: string | null
      _ref?: string | null
      id?: number | null
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
  if ('sanity_id' in upload && upload.sanity_id && upload.sanity_id.trim().length > 0) {
    return upload.sanity_id
  }
  if ('sanityAssetId' in upload && upload.sanityAssetId && upload.sanityAssetId.trim().length > 0) {
    return upload.sanityAssetId
  }

  return null
}

export function resolveMediaId(upload: SanityUploadReference): number | null {
  if (upload == null) return null

  if (v.is(v.number(), upload)) {
    return Number.isFinite(upload) ? upload : null
  }

  if (v.is(v.string(), upload)) {
    return /^\d+$/.test(upload) ? Number(upload) : null
  }

  if ('id' in upload && upload.id != null && Number.isFinite(upload.id)) {
    return upload.id
  }

  return null
}
