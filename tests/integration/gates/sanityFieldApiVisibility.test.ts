import { describe, expect, test } from 'bun:test'

import { sanityMediaForceSelect } from '../../../src/populate/forceSelect.js'

describe('sanityFieldApiVisibility', () => {
  test('forceSelect always includes hidden sanity group and focal fields for default', () => {
    expect(sanityMediaForceSelect('default')).toMatchObject({
      sanity: true,
      alt: true,
      sync: true,
      focalX: true,
      focalY: true,
    })
  })

  test('forceSelect includes sanity group for full preset', () => {
    expect(sanityMediaForceSelect('full')).toMatchObject({
      sanity: true,
      alt: true,
      sync: true,
    })
    expect(sanityMediaForceSelect('full')).not.toHaveProperty('focalX')
  })
})
