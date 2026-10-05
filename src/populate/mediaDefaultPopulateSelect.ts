import type { CollectionConfig } from 'payload'

/** Select used as Payload `defaultPopulate` when preset is `default` (nested `image: true`, etc.). */
export function sanityMediaDefaultPopulateSelect(): NonNullable<CollectionConfig['defaultPopulate']> {
  return {
    id: true,
    filename: true,
    name: true,
    url: true,
    thumbnailURL: true,
    width: true,
    height: true,
    focalX: true,
    focalY: true,
    alt: true,
    mimeType: true,
    sanity: {
      id: true,
      path: true,
      url: true,
      metadata: {
        dimensions: true,
        lqip: true,
      },
    },
  }
}
