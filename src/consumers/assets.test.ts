import { describe, expect, it } from 'bun:test'
import { isMediaAsset, isMediaImageAsset } from './assets'

const asset = {
  id: 'media-1',
  url: 'https://cdn.sanity.io/images/project/dataset/image-1-1200x800.jpg',
  focalX: 50,
  focalY: 50,
  alt: null,
}

describe('isMediaAsset', () => {
  it('accepts the normalized default response with optional image metadata omitted', () => {
    expect(isMediaAsset(asset)).toBe(true)
  })

  it('accepts normalized file assets without treating them as images', () => {
    const file = { ...asset, url: 'https://cdn.sanity.io/files/project/dataset/manual.pdf' }

    expect(isMediaAsset(file)).toBe(true)
    expect(isMediaImageAsset(file)).toBe(false)
  })

  it('rejects file assets even when their filename has an image extension', () => {
    const file = { ...asset, url: 'https://cdn.sanity.io/files/project/dataset/photo.jpg' }

    expect(isMediaAsset(file)).toBe(true)
    expect(isMediaImageAsset(file)).toBe(false)
  })

  it('narrows image assets without changing their serialized shape', () => {
    const before = JSON.stringify(asset)

    expect(isMediaImageAsset(asset)).toBe(true)
    expect(JSON.stringify(asset)).toBe(before)
  })

  it('rejects IDs, full documents, and unavailable assets', () => {
    expect(isMediaAsset('media-1')).toBe(false)
    expect(isMediaAsset({ ...asset, url: '' })).toBe(false)
    expect(isMediaAsset({ ...asset, focalX: undefined })).toBe(false)
    expect(isMediaAsset({ ...asset, width: Number.NaN })).toBe(false)
  })
})
