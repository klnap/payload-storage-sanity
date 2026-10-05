import { describe, expect, test } from 'bun:test'

import { toSanityImageProps } from '../../../src/next/toSanityImageProps.js'

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
})
