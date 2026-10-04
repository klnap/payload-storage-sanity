import { describe, expect, test } from 'bun:test'

import {
  resolveSanityImageFallback,
  shouldUseSanityImageFallback,
} from '../../../src/next/resolveSanityImageFallback.js'

describe('resolveSanityImageFallback', () => {
  test('returns null when fallback is null', () => {
    expect(resolveSanityImageFallback('missing', { fallback: null })).toBeNull()
  })

  test('returns null when fallback is undefined', () => {
    expect(resolveSanityImageFallback('missing', {})).toBeNull()
  })

  test('returns fallback node when set', () => {
    const node = { type: 'glass' }
    expect(resolveSanityImageFallback('error', { fallback: node })).toBe(node)
  })

  test('renderFallback wins over fallback JSX', () => {
    const out = resolveSanityImageFallback('missing', {
      fallback: 'jsx',
      renderFallback: ({ reason }) => `fn:${reason}`,
      asset: { url: 'https://cdn/x.jpg' },
    })
    expect(out).toBe('fn:missing')
  })
})

describe('shouldUseSanityImageFallback', () => {
  test('false when no fallback configured', () => {
    expect(shouldUseSanityImageFallback(false, false, undefined)).toBe(false)
    expect(shouldUseSanityImageFallback(true, true, undefined)).toBe(false)
  })

  test('false when fallback is explicitly null', () => {
    expect(shouldUseSanityImageFallback(false, false, null)).toBe(false)
  })

  test('true when missing image and fallback exists', () => {
    expect(shouldUseSanityImageFallback(false, false, 'placeholder')).toBe(true)
  })

  test('true when load failed and fallback exists', () => {
    expect(shouldUseSanityImageFallback(true, true, 'placeholder')).toBe(true)
  })

  test('true when renderFallback is set without fallback JSX', () => {
    expect(
      shouldUseSanityImageFallback(false, false, undefined, () => null)
    ).toBe(true)
  })
})
