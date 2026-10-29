import type { CollectionConfig } from 'payload'

import { localizedAltPopulateSelect } from './localizedAltSelect'

/** Select used as Payload `defaultPopulate` when preset is `default` (nested `image: true`, etc.). */
export function sanityMediaDefaultPopulateSelect(
  localeCodes: readonly string[] = []
): NonNullable<CollectionConfig['defaultPopulate']> {
  return {
    id: true,
    filename: true,
    url: true,
    thumbnailURL: true,
    width: true,
    height: true,
    focalX: true,
    focalY: true,
    alt: localizedAltPopulateSelect(localeCodes),
    mimeType: true,
    sanity: {
      asset: {
        _id: true,
        path: true,
        url: true,
        metadata: {
          dimensions: true,
          lqip: true,
        },
      },
    },
  }
}
