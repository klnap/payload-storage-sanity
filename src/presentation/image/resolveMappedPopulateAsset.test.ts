import { describe, expect, test } from 'bun:test'
import { toSanityImageProps } from '@/consumers/next'
import { resolveMappedPopulateAsset } from '@/presentation/image'

const defaultAsset = {
  id: 'media-1',
  url: 'https://cdn.example/hero.jpg',
  alt: 'Hero',
  width: 1200,
  height: 800,
  focalX: 40,
  focalY: 60,
  lqip: 'data:image/jpeg;base64,abc',
}

describe('resolveMappedPopulateAsset', () => {
  test('returns null when asset is null', () => {
    expect(resolveMappedPopulateAsset(null, { url: 'image' })).toBeNull()
  })

  test('returns null when mapped url is missing', () => {
    expect(
      resolveMappedPopulateAsset({ image: '' }, { url: 'image', width: 'metadata.width' })
    ).toBeNull()
  })

  test('maps flat custom fields', () => {
    const custom = {
      image: 'https://cdn.example/custom.jpg',
      title: 'Custom alt',
      w: 640,
      h: 480,
    }

    const mapped = resolveMappedPopulateAsset(custom, {
      url: 'image',
      alt: 'title',
      width: 'w',
      height: 'h',
      id: 'image',
    })

    expect(mapped).toEqual({
      id: 'https://cdn.example/custom.jpg',
      url: 'https://cdn.example/custom.jpg',
      alt: 'Custom alt',
      width: 640,
      height: 480,
    })
  })

  test('maps nested custom fields', () => {
    const custom = {
      image: 'https://cdn.example/nested.jpg',
      metadata: {
        width: 1200,
        height: 800,
        blur: 'data:image/jpeg;base64,xyz',
      },
    }

    const mapped = resolveMappedPopulateAsset(custom, {
      url: 'image',
      width: 'metadata.width',
      height: 'metadata.height',
      lqip: 'metadata.blur',
    })

    expect(mapped).toEqual({
      id: '',
      url: 'https://cdn.example/nested.jpg',
      alt: null,
      width: 1200,
      height: 800,
      lqip: 'data:image/jpeg;base64,xyz',
    })
  })

  test('does not mutate the source asset', () => {
    const custom = {
      image: 'https://cdn.example/keep.jpg',
      metadata: { width: 100 },
    }
    const snapshot = JSON.stringify(custom)

    resolveMappedPopulateAsset(custom, {
      url: 'image',
      width: 'metadata.width',
    })

    expect(JSON.stringify(custom)).toBe(snapshot)
  })

  test('feeds the existing toSanityImageProps path like a default populated asset', () => {
    const custom = {
      image: defaultAsset.url,
      caption: defaultAsset.alt,
      metadata: {
        width: defaultAsset.width,
        height: defaultAsset.height,
      },
      focal: { x: defaultAsset.focalX, y: defaultAsset.focalY },
      lqip: defaultAsset.lqip,
    }

    const mapped = resolveMappedPopulateAsset(custom, {
      url: 'image',
      alt: 'caption',
      width: 'metadata.width',
      height: 'metadata.height',
      focalX: 'focal.x',
      focalY: 'focal.y',
      lqip: 'lqip',
      id: 'image',
    })

    const fromMapped = toSanityImageProps(mapped)
    const fromDefault = toSanityImageProps(defaultAsset)

    expect(fromMapped).toEqual(fromDefault)
  })
})
