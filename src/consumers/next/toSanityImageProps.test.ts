import { describe, expect, test } from 'bun:test'

import { toSanityImageProps } from '@/consumers/next/toSanityImageProps'

describe('toSanityImageProps', () => {
  test('maps alt from MediaAsset without locale opts', () => {
    const props = toSanityImageProps({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/img.jpg',
      alt: 'Hero',
      focalX: 50,
      focalY: 50,
      width: 800,
      height: 600,
    })

    expect(props?.alt).toBe('Hero')
    expect(props?.src).toBe('https://cdn.sanity.io/images/demo/production/img.jpg')
    expect(props?.style?.objectPosition).toBe('50% 50%')
  })

  test('explicit alt="" override marks the image decorative and beats the asset description', () => {
    const props = toSanityImageProps(
      {
        id: 1,
        url: 'https://cdn.sanity.io/images/demo/production/img.jpg',
        alt: 'Hero',
        focalX: 50,
        focalY: 50,
        width: 800,
        height: 600,
      },
      { alt: '' }
    )

    expect(props?.alt).toBe('')
  })

  test('explicitly empty asset alt stays empty and is not replaced by fallbackAlt', () => {
    const props = toSanityImageProps(
      {
        id: 1,
        url: 'https://cdn.sanity.io/images/demo/production/img.jpg',
        alt: '',
        focalX: 50,
        focalY: 50,
        width: 800,
        height: 600,
      },
      { fallbackAlt: 'Decorative fallback' }
    )

    expect(props?.alt).toBe('')
  })

  test('missing alt uses fallbackAlt', () => {
    const props = toSanityImageProps(
      {
        id: 1,
        url: 'https://cdn.sanity.io/images/demo/production/img.jpg',
        alt: null,
        focalX: 50,
        focalY: 50,
        width: 800,
        height: 600,
      },
      { fallbackAlt: 'Fallback' }
    )

    expect(props?.alt).toBe('Fallback')
  })

  test('uses blur placeholder fallback when lqip is missing but url is present', () => {
    const props = toSanityImageProps({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/hero.jpg',
      alt: null,
      focalX: 50,
      focalY: 50,
      width: 800,
      height: 600,
    })

    expect(props?.placeholder).toBe('blur')
    expect(props?.blurDataURL).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('keeps empty placeholder when fallback disabled', () => {
    const props = toSanityImageProps(
      {
        id: 1,
        url: 'https://cdn.sanity.io/images/demo/production/hero.jpg',
        alt: null,
        focalX: 50,
        focalY: 50,
        width: 800,
        height: 600,
      },
      { placeholderFallback: false }
    )

    expect(props?.placeholder).toBe('empty')
    expect(props?.blurDataURL).toBeUndefined()
  })

  test('does not derive next/image props for Sanity file assets', () => {
    for (const url of [
      'https://cdn.sanity.io/files/demo/production/manual.pdf',
      'https://cdn.sanity.io/files/demo/production/photo.jpg',
    ]) {
      expect(
        toSanityImageProps({
          id: 1,
          url,
          alt: 'File',
          focalX: 50,
          focalY: 50,
        })
      ).toBeNull()
    }
  })

  test('rejects malformed or non-image inputs without producing image props', () => {
    expect(toSanityImageProps(null)).toBeNull()
    expect(
      toSanityImageProps({ id: 1, url: 'https://cdn.sanity.io/images/demo/photo.pdf' })
    ).toBeNull()
    expect(
      toSanityImageProps({
        id: 1,
        url: 'https://cdn.sanity.io/images/demo/photo.jpg',
        alt: null,
        focalX: Number.NaN,
        focalY: 50,
      })
    ).toBeNull()
  })

  test('uses the configured CDN origin as the rendered src', () => {
    const props = toSanityImageProps(
      {
        id: 1,
        url: 'https://cdn.sanity.io/images/demo/production/img.jpg',
        alt: 'Hero',
        focalX: 50,
        focalY: 50,
        width: 800,
        height: 600,
      },
      { cdnBaseUrl: 'https://images.example.com' }
    )

    expect(props?.src).toBe('https://images.example.com/images/demo/production/img.jpg')
  })
})
