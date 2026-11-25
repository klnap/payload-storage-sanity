import type { JsonObject } from '@/core/contracts'
import type { PayloadMediaDraft, PayloadMediaPatch } from '@/features/media/document'
import type { SanityAsset } from '@/sanity/assets'
import { toPersistedSanityAssetDocument } from '@/sanity/assets'

export type UploadFileMeta = {
  filename: string
  mimeType: string
}

export function mapSanityUploadToMedia(
  asset: SanityAsset,
  _file: UploadFileMeta,
  data: PayloadMediaDraft = {},
  raw?: JsonObject
): PayloadMediaPatch {
  const assetDocument = toPersistedSanityAssetDocument(raw ?? {}, asset)

  return {
    ...data,
    sanity: {
      asset: assetDocument,
    },
  } satisfies PayloadMediaPatch
}
