import { describe, expect, test } from 'bun:test'

import { sanityMediaForceSelect } from '@/features/media/populate'

describe('sanityFieldApiVisibility', () => {
  test('forceSelect always includes hidden sanity group and focal fields for default', () => {
    expect(sanityMediaForceSelect('default')).toMatchObject({
      sanity: { asset: { metadata: { lqip: true, dimensions: true } } },
      alt: true,
      sync: true,
      focalX: true,
      focalY: true,
    })
    expect(sanityMediaForceSelect('default', ['pl', 'en'])).toMatchObject({
      alt: { pl: true, en: true },
    })
  })

  test('forceSelect includes sanity group for full preset', () => {
    expect(sanityMediaForceSelect('full')).toMatchObject({
      sanity: { asset: { metadata: { lqip: true, dimensions: true } } },
      alt: true,
      sync: true,
    })
    expect(sanityMediaForceSelect('full')).not.toHaveProperty('focalX')
  })
})
