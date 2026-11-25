import { describe, expect, test } from 'bun:test'

import { withContentHashLock } from '@/features/media/lifecycle/dedupe'

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

  test('queues every same-hash caller behind the previous caller', async () => {
    const gate = Promise.withResolvers<void>()
    let active = 0
    let maxActive = 0
    const run = () =>
      withContentHashLock('hash-three-callers', async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await gate.promise
        active -= 1
      })

    const calls = [run(), run(), run()]
    await Promise.resolve()
    gate.resolve()
    await Promise.all(calls)

    expect(maxActive).toBe(1)
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
