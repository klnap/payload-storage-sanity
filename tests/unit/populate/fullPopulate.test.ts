import { describe, expect, test } from 'bun:test'

import { createPopulate, fullPopulate, getFullPopulateBase } from '../../../src/populate/fullPopulate.js'

describe('fullPopulate', () => {
  test('includes sanity and sync in base', () => {
    const select = getFullPopulateBase()
    expect(select).toMatchObject({
      filename: true,
      sync: { status: true },
      sanity: { path: true },
    })
  })

  test('fullPopulate() returns base by default', () => {
    expect(fullPopulate()).toEqual(getFullPopulateBase())
  })

  test('createPopulate extend and exclude', () => {
    const populate = createPopulate({
      extend: { credit: true },
      exclude: ['mimeType'],
    })

    const result = populate({ exclude: ['thumbnailURL'] })
    expect(result).toMatchObject({ credit: true, filename: true })
    expect(result).not.toHaveProperty('mimeType')
    expect(result).not.toHaveProperty('thumbnailURL')
  })
})
