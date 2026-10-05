import { describe, expect, test } from 'bun:test'

import {
  countDeleteTargetsFromWhere,
  isBulkMediaDelete,
  isBulkMediaDeleteFromWhere,
} from '../../../src/utils/bulkDelete.js'

describe('bulkDelete helpers', () => {
  test('countDeleteTargetsFromWhere reads id.in length', () => {
    expect(
      countDeleteTargetsFromWhere({
        and: [{ id: { in: ['a', 'b', 'c'] } }],
      } as never)
    ).toBe(3)
  })

  test('countDeleteTargetsFromWhere returns 1 for id.equals', () => {
    expect(countDeleteTargetsFromWhere({ id: { equals: 'x' } } as never)).toBe(1)
  })

  test('isBulkMediaDeleteFromWhere true for multiple ids or select-all', () => {
    expect(isBulkMediaDeleteFromWhere({ id: { in: ['a', 'b'] } } as never)).toBe(true)
    expect(isBulkMediaDeleteFromWhere({ id: { not_equals: '' } } as never)).toBe(true)
    expect(isBulkMediaDeleteFromWhere({ id: { in: ['a'] } } as never)).toBe(false)
  })

  test('isBulkMediaDelete respects context flag', () => {
    expect(isBulkMediaDelete({ bulkDelete: true }, { id: { equals: 'a' } } as never)).toBe(
      true
    )
    expect(isBulkMediaDelete(undefined, { id: { equals: 'a' } } as never)).toBe(false)
  })
})
