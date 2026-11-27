import { describe, expect, it } from 'bun:test'
import { resolveRenderableMediaAsset } from './image/resolveRenderableMediaAsset'

const image = {
  id: 'media-1',
  url: 'https://cdn.sanity.io/images/project/dataset/image-1-1200x800.jpg',
  focalX: 50,
  focalY: 50,
  alt: null,
}

describe('resolveRenderableMediaAsset', () => {
  it('accepts normalized Sanity image assets', () => {
    expect(resolveRenderableMediaAsset(image)).toEqual(image)
  })

  it('rejects files, including image-looking filenames, and malformed media', () => {
    expect(
      resolveRenderableMediaAsset({
        ...image,
        url: 'https://cdn.sanity.io/files/project/dataset/photo.jpg',
      })
    ).toBeNull()
    expect(resolveRenderableMediaAsset({ ...image, url: 'not a URL' })).toBeNull()
    expect(resolveRenderableMediaAsset({ ...image, focalX: 101 })).toBeNull()
    expect(resolveRenderableMediaAsset({ ...image, focalX: Number.NaN })).toBeNull()
    expect(resolveRenderableMediaAsset({ ...image, width: 0 })).toBeNull()
    expect(resolveRenderableMediaAsset({ ...image, width: Number.POSITIVE_INFINITY })).toBeNull()
    expect(resolveRenderableMediaAsset(null)).toBeNull()
  })

  it('accepts SVG image assets without applying image transformations', () => {
    expect(
      resolveRenderableMediaAsset({
        ...image,
        url: 'https://cdn.sanity.io/images/project/dataset/brand.svg',
      })
    ).not.toBeNull()
  })
})
