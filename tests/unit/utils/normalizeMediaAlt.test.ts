import { describe, expect, test } from 'bun:test'

import { normalizeLocalizedAltGroup } from '../../../src/utils/normalizeMediaAlt.js'

describe('normalizeLocalizedAltGroup', () => {
  test('coerces null to empty object when localized group', () => {
    expect(normalizeLocalizedAltGroup(null, true)).toEqual({})
  })

  test('leaves null when plain alt field', () => {
    expect(normalizeLocalizedAltGroup(null, false)).toBe(null)
  })

  test('preserves existing group values', () => {
    expect(normalizeLocalizedAltGroup({ pl: 'x' }, true)).toEqual({ pl: 'x' })
  })
})
