import { describe, expect, test } from 'bun:test'

import { resolveAssetAlt } from '../../../src/next/resolveAssetAlt.js'

describe('resolveAssetAlt', () => {
  test('uses asset.alt when present', () => {
    expect(resolveAssetAlt({ alt: 'Caption' })).toBe('Caption')
    expect(resolveAssetAlt({ alt: '  spaced  ' })).toBe('spaced')
  })

  test('opts.alt overrides asset', () => {
    expect(resolveAssetAlt({ alt: 'CMS' }, { alt: 'Override' })).toBe('Override')
  })

  test('null or empty asset.alt falls back to fallbackAlt', () => {
    expect(resolveAssetAlt({ alt: null }, { fallbackAlt: 'Decorative' })).toBe('Decorative')
    expect(resolveAssetAlt({ alt: '   ' }, { fallbackAlt: 'Decorative' })).toBe('Decorative')
  })

  test('returns empty string when nothing resolves', () => {
    expect(resolveAssetAlt({ alt: null })).toBe('')
    expect(resolveAssetAlt(null)).toBe('')
  })
})
