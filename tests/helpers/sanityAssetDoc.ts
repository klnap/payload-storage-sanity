import type { JsonObject } from '@/core/contracts'
import type { SanityMediaDocument } from '@/features/media/document'

type AssetSeed = {
  _id: string
  path?: string
  url?: string
  sha1hash?: string
  metadata?: Record<string, unknown>
  _type?: string
}

export function mediaWithSanityAsset(
  seed: AssetSeed,
  rest: Partial<SanityMediaDocument> = {}
): SanityMediaDocument {
  return {
    ...rest,
    sanity: {
      asset: {
        _type: seed._type ?? 'sanity.imageAsset',
        path: seed.path ?? '',
        url: seed.url ?? '',
        ...seed,
      } as JsonObject,
    },
  }
}
