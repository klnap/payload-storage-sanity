import { describe, expect, test } from 'bun:test'

import { defaultPopulateMediaDoc } from '../../../src/populate/defaultPopulateMediaDoc.js'

const baseDoc = {
  id: 1,
  focalX: 10,
  focalY: 20,
  alt: 'Hero',
  sync: { status: 'available' as const },
  sanity: {
    id: 'image-abc-800x600-jpg',
    type: 'sanity.imageAsset',
    path: 'images/demo/production/abc-800x600.jpg',
    url: 'https://cdn.sanity.io/images/demo/production/abc-800x600.jpg',
    source: 'dataset' as const,
    metadata: {
      dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
      lqip: 'data:image/jpeg;base64,x',
    },
  },
}

describe('defaultPopulateMediaDoc', () => {
  test('returns flat DefaultPopulateAsset with url only (no path)', () => {
    const result = defaultPopulateMediaDoc(baseDoc)
    expect(result).toMatchObject({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/abc-800x600.jpg',
      width: 800,
      height: 600,
      focalX: 10,
      focalY: 20,
      alt: 'Hero',
    })
    expect('path' in result).toBe(false)
  })

  test('resolves localized alt from context locale', () => {
    const result = defaultPopulateMediaDoc(
      {
        ...baseDoc,
        alt: { pl: 'Opis PL', en: 'Caption EN' },
      },
      { locale: 'pl' }
    )
    expect(result.alt).toBe('Opis PL')
  })

  test('omits alt when locale has no value', () => {
    const result = defaultPopulateMediaDoc(
      {
        ...baseDoc,
        alt: { pl: 'Opis PL', en: 'Caption EN' },
      },
      { locale: 'de' }
    )
    expect(result.alt).toBeUndefined()
  })

  test('omits alt when empty', () => {
    const result = defaultPopulateMediaDoc({
      ...baseDoc,
      alt: undefined,
    })
    expect(result.alt).toBeUndefined()
  })
})
