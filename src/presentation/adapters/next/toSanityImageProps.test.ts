import { describe, expect, test } from 'bun:test'

import { toSanityImageProps } from '@/consumers/next'

describe('toSanityImageProps', () => {
  test('maps alt from DefaultPopulateAsset without locale opts', () => {
    const props = toSanityImageProps({
      id: 1,
      url: 'https://cdn.example/img.jpg',
      alt: 'Hero',
      width: 800,
      height: 600,
    })

    expect(props?.alt).toBe('Hero')
    expect(props?.src).toBe('https://cdn.example/img.jpg')
  })

  test('explicit alt="" override marks the image decorative and beats the asset description', () => {
    const props = toSanityImageProps(
      { id: 1, url: 'https://cdn.example/img.jpg', alt: 'Hero', width: 800, height: 600 },
      { alt: '' }
    )

    expect(props?.alt).toBe('')
  })

  test('explicitly empty asset alt stays empty and is not replaced by fallbackAlt', () => {
    const props = toSanityImageProps(
      { id: 1, url: 'https://cdn.example/img.jpg', alt: '', width: 800, height: 600 },
      { fallbackAlt: 'Decorative fallback' }
    )

    expect(props?.alt).toBe('')
  })

  test('missing alt uses fallbackAlt', () => {
    const props = toSanityImageProps(
      { id: 1, url: 'https://cdn.example/img.jpg', alt: null, width: 800, height: 600 },
      { fallbackAlt: 'Fallback' }
    )

    expect(props?.alt).toBe('Fallback')
  })

  test('uses blur placeholder fallback when lqip is missing but url is present', () => {
    const props = toSanityImageProps({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/hero.jpg',
      alt: null,
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
        width: 800,
        height: 600,
      },
      { placeholderFallback: false }
    )

    expect(props?.placeholder).toBe('empty')
    expect(props?.blurDataURL).toBeUndefined()
  })
})
