import { describe, expect, test } from 'bun:test'

import {
  imageDimensionsFromMedia,
  isMediaAssetAvailable,
} from '../../../src/utils/mediaAvailability.js'

describe('isMediaAssetAvailable', () => {
  test('returns false for deleted sync status', () => {
    expect(
      isMediaAssetAvailable({
        id: 1,
        url: 'https://cdn.example.com/a.jpg',
        sync: { status: 'deleted' },
      })
    ).toBe(false)
  })

  test('returns false when asset id exists without upstream locators', () => {
    expect(
      isMediaAssetAvailable({
        id: 1,
        sanity: { id: 'image-abc' },
        url: null,
        sync: { status: 'available' },
      })
    ).toBe(false)
  })

  test('returns true when path is present and status is available', () => {
    expect(
      isMediaAssetAvailable({
        id: 1,
        sanity: { path: 'images/demo/a.jpg' },
        sync: { status: 'available' },
      })
    ).toBe(true)
  })
})

describe('imageDimensionsFromMedia', () => {
  test('extracts dimensions from sanity.metadata or top-level properties', () => {
    expect(
      imageDimensionsFromMedia({
        id: 1,
        sanity: {
          metadata: { dimensions: { width: 800, height: 600, aspectRatio: 1.33 } },
        },
      })
    ).toEqual({ width: 800, height: 600, aspectRatio: 1.33 })

    expect(
      imageDimensionsFromMedia({
        id: 2,
        width: 1000,
        height: 500,
      })
    ).toEqual({ width: 1000, height: 500, aspectRatio: 2 })
  })
})
