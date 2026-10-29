import { describe, expect, test } from 'bun:test'

import { enrichMediaSanityMetadataForPopulate } from '@/features/media/populate'

describe('enrichMediaSanityMetadataForPopulate', () => {
  test('loads lqip via findByID when nested populate omitted sanity metadata', async () => {
    const doc = {
      id: 'media-1',
      width: 800,
      height: 600,
      sync: { status: 'available' },
    }

    let findByIDContext: unknown
    let findByIDSelect: unknown
    const req = {
      payload: {
        findByID: async (args: { req?: { context?: unknown }; select?: unknown }) => {
          findByIDContext = args.req?.context
          findByIDSelect = args.select
          return {
            id: 'media-1',
            sanity: {
              asset: {
                metadata: {
                  lqip: 'data:image/jpeg;base64,abc',
                  dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
                },
              },
            },
          }
        },
      },
      context: {},
    }

    const enriched = await enrichMediaSanityMetadataForPopulate(doc as never, {
      req: req as never,
      collectionSlug: 'media',
    })

    const metadata = enriched.sanity?.asset?.metadata
    expect(
      metadata != null &&
        typeof metadata === 'object' &&
        !Array.isArray(metadata) &&
        'lqip' in metadata &&
        metadata.lqip
    ).toBe('data:image/jpeg;base64,abc')
    expect(findByIDContext).toMatchObject({
      sanityStorage: { skipPopulate: true },
    })
    expect(findByIDSelect).toMatchObject({
      sanity: { asset: { metadata: { lqip: true } } },
    })
  })

  test('loads localized alt via findByID when nested populate omitted alt but lqip is present', async () => {
    const doc = {
      id: 'media-1',
      sync: { status: 'available' },
      sanity: {
        asset: {
          metadata: {
            lqip: 'data:image/jpeg;base64,abc',
            dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
          },
        },
      },
    }

    const req = {
      payload: {
        findByID: async () => ({
          id: 'media-1',
          alt: { pl: 'Opis PL', en: 'Caption EN' },
        }),
      },
      context: {},
    }

    const enriched = await enrichMediaSanityMetadataForPopulate(doc as never, {
      req: req as never,
      collectionSlug: 'media',
      localizedAltGroup: true,
    })

    expect(enriched.alt).toEqual({ pl: 'Opis PL', en: 'Caption EN' })
  })
})
