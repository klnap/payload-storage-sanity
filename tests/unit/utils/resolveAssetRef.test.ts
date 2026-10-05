import { describe, expect, test } from 'bun:test'

import { resolveImageFileRef, resolveMediaId } from '../../../src/utils/resolveAssetRef.js'

describe('resolveImageFileRef', () => {
  test('extracts _ref from Sanity asset reference', () => {
    expect(resolveImageFileRef({ _type: 'reference', _ref: 'image-abc-800x600-jpg' })).toBe(
      'image-abc-800x600-jpg'
    )
  })

  test('extracts sanity.id from populated media', () => {
    expect(
      resolveImageFileRef({
        id: 1,
        sanity: { id: 'image-abc-800x600-jpg' },
      })
    ).toBe('image-abc-800x600-jpg')
  })

  test('extracts raw id when formatted as Sanity image id', () => {
    expect(resolveImageFileRef('image-abc-800x600-jpg')).toBe('image-abc-800x600-jpg')
  })

  test('returns null for unresolvable value', () => {
    expect(resolveImageFileRef(null)).toBeNull()
    expect(resolveImageFileRef(123)).toBeNull()
    expect(resolveImageFileRef({})).toBeNull()
  })
})

describe('resolveMediaId', () => {
  test('extracts numeric and string media IDs', () => {
    expect(resolveMediaId(42)).toBe(42)
    expect(resolveMediaId('42')).toBe(42)
    expect(resolveMediaId({ id: 99 })).toBe(99)
    expect(resolveMediaId(null)).toBeNull()
    expect(resolveMediaId('0babf185-2616-41ab-9fb0-1a7f752f5af8')).toBe(
      '0babf185-2616-41ab-9fb0-1a7f752f5af8'
    )
    expect(resolveMediaId({ id: '0babf185-2616-41ab-9fb0-1a7f752f5af8' })).toBe(
      '0babf185-2616-41ab-9fb0-1a7f752f5af8'
    )
  })
})
