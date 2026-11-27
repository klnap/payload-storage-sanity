import { describe, expect, test } from 'bun:test'
import type { SanityMediaDocument } from '@/features/media/document'
import { defaultPopulateMediaDoc } from '@/features/media/populate'

const baseDoc: SanityMediaDocument = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
  sanity: {
    asset: {
      _id: 'image-abc-jpg',
      path: 'images/demo/production/abc.jpg',
      url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
      metadata: {
        dimensions: { width: 800, height: 600, aspectRatio: 1.333 },
        lqip: 'data:image/jpeg;base64,/9j/',
      },
    },
  },
  alt: 'Caption',
}

describe('defaultPopulateMediaDoc', () => {
  test('returns MediaAsset with url only (no path)', () => {
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
    expect(result?.alt).toBe('Opis')
  })

  test('missing translation returns null alt, not the other locale', () => {
    const result = defaultPopulateMediaDoc({ ...baseDoc, alt: { en: 'Caption' } }, { locale: 'pl' })
    expect(result?.alt).toBeNull()
  })

  test('explicitly empty translation returns empty alt', () => {
    const result = defaultPopulateMediaDoc(
      { ...baseDoc, alt: { pl: '', en: 'Caption' } },
      { locale: 'pl' }
    )
    expect(result?.alt).toBe('')
  })

  test('missing plain alt returns null', () => {
    const result = defaultPopulateMediaDoc({ ...baseDoc, alt: undefined })
    expect(result?.alt).toBeNull()
  })
})
