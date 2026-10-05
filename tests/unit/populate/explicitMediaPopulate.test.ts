import { describe, expect, test } from 'bun:test'

import { hasExplicitMediaPopulateSelect } from '../../../src/populate/explicitMediaPopulate.js'

describe('hasExplicitMediaPopulateSelect', () => {
  test('false when populate missing', () => {
    expect(hasExplicitMediaPopulateSelect({ query: {} } as never, 'media')).toBe(false)
  })

  test('true when populate.media is a field map', () => {
    expect(
      hasExplicitMediaPopulateSelect(
        { query: { populate: { media: { filename: true } } } } as never,
        'media'
      )
    ).toBe(true)
  })

  test('false when populate.media is empty object', () => {
    expect(
      hasExplicitMediaPopulateSelect({ query: { populate: { media: {} } } } as never, 'media')
    ).toBe(false)
  })
})
