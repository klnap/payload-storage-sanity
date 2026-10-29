import { describe, expect, test } from 'bun:test'

import { resolveCollectionAdmin } from '@/core/config'

describe('resolveCollectionAdmin', () => {
  test('defaults uploadBusyShield true', () => {
    expect(resolveCollectionAdmin(undefined, true)).toEqual({
      uploadBusyShield: true,
    })
  })

  test('merges plugin and collection admin options', () => {
    expect(
      resolveCollectionAdmin({ uploadBusyShield: true }, { admin: { uploadBusyShield: false } })
    ).toEqual({
      uploadBusyShield: false,
    })
  })
})
