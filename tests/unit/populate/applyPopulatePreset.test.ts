import { describe, expect, test } from 'bun:test'

import { applyPopulatePreset } from '../../../src/populate/applyPopulatePreset.js'
import { defineSanityMediaPopulatePreset } from '../../../src/populate/presets.js'

const doc = {
  id: 1,
  alt: { pl: 'PL', en: 'EN' },
  sync: { status: 'available' as const },
  sanity: {
    id: 'image-abc-800x600-jpg',
    type: 'sanity.imageAsset',
    path: 'images/demo/production/abc-800x600.jpg',
    url: 'https://cdn.sanity.io/images/demo/production/abc-800x600.jpg',
    source: 'dataset' as const,
    metadata: {
      dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
    },
  },
}

describe('applyPopulatePreset custom shape', () => {
  test('passes locale into custom preset context', () => {
    const myPreset = defineSanityMediaPopulatePreset('myPreset', {
      shape(_doc, ctx) {
        return { locale: ctx.locale }
      },
    })

    const result = applyPopulatePreset(doc, 'myPreset', { myPreset }, {
      locale: 'en',
    })

    expect(result).toEqual({ locale: 'en' })
  })
})
