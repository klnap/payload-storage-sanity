import { describe, expect, test } from 'bun:test'

import { applyPopulatePreset } from '@/features/media/populate'

const doc = {
  id: 1,
  alt: { pl: 'PL', en: 'EN' },
  sync: { status: 'available' as const },
  sanity: {
    asset: {
      _id: 'image-abc-800x600-jpg',
      _type: 'sanity.imageAsset',
      path: 'images/demo/production/abc-800x600.jpg',
      url: 'https://cdn.sanity.io/images/demo/production/abc-800x600.jpg',
      metadata: {
        dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
      },
    },
  },
}

describe('applyPopulatePreset', () => {
  test('default preset passes locale into flat DTO', () => {
    const result = applyPopulatePreset(doc, 'default', {
      locale: 'en',
    })

    expect(result).toMatchObject({
      id: 1,
      url: expect.stringContaining('abc-800x600.jpg'),
      width: 800,
    })
    expect(result).not.toHaveProperty('sanity')
  })

  test('full preset returns document unchanged', () => {
    expect(applyPopulatePreset(doc, 'full')).toBe(doc)
  })

  test('default preset returns full doc when url cannot be resolved (no flat DTO)', () => {
    const unavailable = {
      ...doc,
      url: null,
      sync: { status: 'deleted' as const },
    }
    const result = applyPopulatePreset(unavailable as never, 'default', { locale: 'en' })
    expect(result).toBe(unavailable)
    expect(result).toHaveProperty('sanity')
    expect(result).not.toMatchObject({ width: 800 })
  })
})
