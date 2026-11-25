import { describe, expect, it } from 'bun:test'
import { isDefaultPopulateAsset } from './assets'

const asset = {
  id: 'media-1',
  url: 'https://cdn.sanity.io/images/project/dataset/image-1-1200x800.jpg',
  focalX: 50,
  focalY: 50,
  alt: null,
}

describe('isDefaultPopulateAsset', () => {
  it('accepts the normalized default response with optional image metadata omitted', () => {
    expect(isDefaultPopulateAsset(asset)).toBe(true)
  })

  it('rejects IDs, full documents, and unavailable assets', () => {
    expect(isDefaultPopulateAsset('media-1')).toBe(false)
    expect(isDefaultPopulateAsset({ ...asset, url: '' })).toBe(false)
    expect(isDefaultPopulateAsset({ ...asset, focalX: undefined })).toBe(false)
    expect(isDefaultPopulateAsset({ ...asset, width: Number.NaN })).toBe(false)
  })
})
