import { describe, expect, test } from 'bun:test'

import { createSanityMediaDeleteAfterOperationHook } from '../../../src/hooks/mediaDeleteAfterOperation.js'

describe('createSanityMediaDeleteAfterOperationHook', () => {
  const hook = createSanityMediaDeleteAfterOperationHook()

  test('no-op on non-delete operations', () => {
    const result = { id: 1 }
    expect(
      hook({
        operation: 'create',
        result,
        args: {} as never,
        collection: {} as never,
        req: {} as never,
      })
    ).toBe(result)
  })

  test('normalizes missing docs and errors arrays on delete', async () => {
    const out = await hook({
      operation: 'delete',
      result: {
        errors: [{ id: '1', isPublic: true, message: 'x' }],
      },
      args: {} as never,
      collection: {} as never,
      req: {} as never,
    })

    expect(out).toEqual({
      errors: [{ id: '1', isPublic: true, message: 'x' }],
      docs: [],
    })
  })

  test('returns empty arrays when delete result is null', async () => {
    const out = await hook({
      operation: 'delete',
      result: null,
      args: {} as never,
      collection: {} as never,
      req: {} as never,
    })

    expect(out).toEqual({ docs: [], errors: [] })
  })
})
