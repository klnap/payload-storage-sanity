import { describe, expect, test } from 'bun:test'

import { resolveSanityStorageMode } from '../../../src/utils/sanityStorageMode.js'

describe('resolveSanityStorageMode', () => {
  test('full enables cloud storage', () => {
    expect(resolveSanityStorageMode({ mode: 'full' })).toEqual({
      mode: 'full',
      cloudStorageEnabled: true,
      alwaysInsertFields: false,
    })
  })

  test('fields-only inserts fields without adapter', () => {
    expect(resolveSanityStorageMode({ mode: 'fields-only' })).toEqual({
      mode: 'fields-only',
      cloudStorageEnabled: false,
      alwaysInsertFields: true,
    })
  })

  test('off disables cloud-storage plugin features', () => {
    expect(resolveSanityStorageMode({ mode: 'off' })).toEqual({
      mode: 'off',
      cloudStorageEnabled: false,
      alwaysInsertFields: false,
    })
  })
})
