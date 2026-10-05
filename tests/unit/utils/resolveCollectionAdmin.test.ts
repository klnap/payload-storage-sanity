import { describe, expect, test } from 'bun:test'

import { resolveCollectionAdmin } from '../../../src/utils/resolveCollectionAdmin.js'

describe('resolveCollectionAdmin', () => {
  test('defaults uploadBusyShield true and usageInspector true', () => {
    expect(resolveCollectionAdmin(undefined, true)).toEqual({
      uploadBusyShield: true,
      usageInspector: true,
    })
  })

  test('merges plugin and collection admin options', () => {
    expect(
      resolveCollectionAdmin(
        { uploadBusyShield: true, usageInspector: true },
        { admin: { usageInspector: false } }
      )
    ).toEqual({
      uploadBusyShield: true,
      usageInspector: false,
    })
  })
})
