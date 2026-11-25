import { describe, expect, test } from 'bun:test'

import { resolveAssetAlt } from '@/presentation/image'

describe('resolveAssetAlt', () => {
  test('uses asset.alt when present', () => {
    expect(resolveAssetAlt({ alt: 'Caption' })).toBe('Caption')
    expect(resolveAssetAlt({ alt: '  spaced  ' })).toBe('spaced')
  })

  test('opts.alt overrides asset', () => {
    expect(resolveAssetAlt({ alt: 'CMS' }, { alt: 'Override' })).toBe('Override')
  })

  test('missing asset.alt falls back to fallbackAlt', () => {
    expect(resolveAssetAlt({ alt: null }, { fallbackAlt: 'Decorative' })).toBe('Decorative')
    expect(resolveAssetAlt({ alt: undefined }, { fallbackAlt: 'Decorative' })).toBe('Decorative')
  })

  test('explicitly empty asset.alt stays empty and is not replaced by fallbackAlt', () => {
    expect(resolveAssetAlt({ alt: '' }, { fallbackAlt: 'Decorative' })).toBe('')
  })

  test('whitespace-only asset.alt is treated as missing', () => {
    expect(resolveAssetAlt({ alt: '   ' }, { fallbackAlt: 'Decorative' })).toBe('Decorative')
    expect(resolveAssetAlt({ alt: '   ' })).toBe('')
  })

  test('explicitly empty override is kept, not replaced by the asset description', () => {
    expect(resolveAssetAlt({ alt: 'Caption' }, { alt: '' })).toBe('')
  })

  test('null or whitespace-only override means no override', () => {
    expect(resolveAssetAlt({ alt: 'Caption' }, { alt: null })).toBe('Caption')
    expect(resolveAssetAlt({ alt: 'Caption' }, { alt: '   ' })).toBe('Caption')
  })

  test('returns empty string when nothing resolves', () => {
    expect(resolveAssetAlt({ alt: null })).toBe('')
    expect(resolveAssetAlt(null)).toBe('')
  })
})
