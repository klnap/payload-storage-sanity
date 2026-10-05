import { describe, expect, test } from 'bun:test'

import { defaultPopulateMediaDoc } from '../../../src/populate/defaultPopulateMediaDoc.js'
import type { SanityMediaDocument } from '../../../src/types/sanityStorageDocument.js'

const baseDoc: SanityMediaDocument = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
  sanity: {
    id: 'image-abc-jpg',
    path: 'images/demo/production/abc.jpg',
    metadata: {
      dimensions: { width: 800, height: 600, aspectRatio: 1.333 },
      lqip: 'data:image/jpeg;base64,/9j/',
    },
  },
  alt: 'Caption',
}

describe('defaultPopulateMediaDoc', () => {
  test('returns DefaultPopulateAsset with url only (no path)', () => {
    const result = defaultPopulateMediaDoc(baseDoc)
    expect(result).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
      width: 800,
      height: 600,
      aspectRatio: 1.333,
      focalX: 50,
      focalY: 50,
      alt: 'Caption',
      lqip: 'data:image/jpeg;base64,/9j/',
    })
    expect(result).not.toHaveProperty('path')
  })

  test('uses localized alt for request locale', () => {
    const result = defaultPopulateMediaDoc(
      { ...baseDoc, alt: { pl: 'Opis', en: 'Caption' } },
      { locale: 'pl' }
    )
    expect(result.alt).toBe('Opis')
  })

  test('falls back when locale missing in group', () => {
    const result = defaultPopulateMediaDoc(
      { ...baseDoc, alt: { en: 'Caption' } },
      { locale: 'pl', fallbackLocale: 'en' }
    )
    expect(result.alt).toBe('Caption')
  })

  test('null alt when empty', () => {
    const result = defaultPopulateMediaDoc({
      ...baseDoc,
      alt: '',
    })
    expect(result.alt).toBeNull()
  })
})
