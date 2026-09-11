import { describe, expect, test } from 'bun:test'

import { withContentHashLock } from '../../../src/utils/lock.js'

describe('withContentHashLock', () => {
  test('serializes concurrent operations for the same content hash', async () => {
    const order: number[] = []

    const p1 = withContentHashLock('hash-a', async () => {
      await new Promise((r) => setTimeout(r, 20))
      order.push(1)
    })

    const p2 = withContentHashLock('hash-a', async () => {
      order.push(2)
    })

    await Promise.all([p1, p2])
    expect(order).toEqual([1, 2])
  })

  test('does not block operations for different content hashes', async () => {
    const order: number[] = []

    const p1 = withContentHashLock('hash-a', async () => {
      await new Promise((r) => setTimeout(r, 20))
      order.push(1)
    })

    const p2 = withContentHashLock('hash-b', async () => {
      order.push(2)
    })

    await Promise.all([p1, p2])
    expect(order).toEqual([2, 1])
  })
})
