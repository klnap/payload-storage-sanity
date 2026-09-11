import { describe, expect, mock, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'

import { fetchSanityAssetSafe, mediaPatchFromSanityAsset } from '../../../src/sync/fetchAsset.js'

const validAsset = {
  _id: 'image-abc-jpg',
  _type: 'sanity.imageAsset',
  assetId: 'abc',
  url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
  mimeType: 'image/jpeg',
  originalFilename: 'abc.jpg',
  metadata: {
    dimensions: { width: 400, height: 300, aspectRatio: 1.33 },
  },
}

describe('fetchSanityAssetSafe', () => {
  test('returns missing for empty asset id without calling upstream', async () => {
    const getDocument = mock(async () => validAsset)
    const client = { getDocument } as unknown as SanityClient

    const result = await fetchSanityAssetSafe(client, '')

    expect(result).toEqual({ status: 'missing', message: 'Empty Sanity asset id' })
    expect(getDocument).not.toHaveBeenCalled()
  })

  test('returns available when Sanity document parses', async () => {
    const client = {
      getDocument: mock(async () => validAsset),
    } as unknown as SanityClient

    const result = await fetchSanityAssetSafe(client, 'image-abc-jpg')

    expect(result.status).toBe('available')
    if (result.status === 'available') {
      expect(result.asset._id).toBe('image-abc-jpg')
    }
  })

  test('returns missing on Sanity 404 without throwing', async () => {
    const notFound = Object.assign(new Error('Not found'), { statusCode: 404 })
    const client = {
      getDocument: mock(async () => {
        throw notFound
      }),
    } as unknown as SanityClient

    const result = await fetchSanityAssetSafe(client, 'image-gone-jpg')

    expect(result).toEqual({ status: 'missing', message: 'Sanity asset not found' })
  })

  test('returns error for non-404 upstream failures', async () => {
    const client = {
      getDocument: mock(async () => {
        throw new Error('upstream timeout')
      }),
    } as unknown as SanityClient

    const result = await fetchSanityAssetSafe(client, 'image-broken-jpg')

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.message).toBe('upstream timeout')
    }
  })

  test('returns missing when document fails schema validation', async () => {
    const client = {
      getDocument: mock(async () => ({ _id: 'file-doc', assetId: 'x' })),
    } as unknown as SanityClient

    const result = await fetchSanityAssetSafe(client, 'file-doc')

    expect(result).toEqual({ status: 'missing', message: 'Sanity asset not found' })
  })
})

describe('mediaPatchFromSanityAsset', () => {
  test('maps asset fields into Payload media patch shape', () => {
    const patch = mediaPatchFromSanityAsset(validAsset as never)

    expect(patch).toMatchObject({
      sanity_id: 'image-abc-jpg',
      url: validAsset.url,
      width: 400,
      height: 300,
    })
  })
})
