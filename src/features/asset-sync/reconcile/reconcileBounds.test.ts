import { describe, expect, mock, test } from 'bun:test'
import { canReconcileCollection, createSanityReconcileEndpoint } from './reconcileEndpoint'
import { RECONCILE_CONCURRENCY, reconcileSanityMedia } from './reconcileSanityMedia'

const docs = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_row, i) => {
    const id = from + i
    return { id, sanity: { asset: { _id: `image-${id}-jpg` } }, sync: { status: 'available' } }
  })

/** Pages of `size` rows over `total` rows, Payload-style pagination metadata. */
function pagedFind(total: number) {
  return mock(async (args: { page: number; limit: number }) => {
    const start = (args.page - 1) * args.limit
    const end = Math.min(start + args.limit, total)
    const rows = docs(start + 1, end)
    return { docs: rows, hasNextPage: end < total }
  })
}

describe('reconcile bounds', () => {
  test('stops at maxRows, reports truncation and the page to resume from', async () => {
    const find = pagedFind(25)
    const client = { getDocument: mock(async () => null) }
    const report = await reconcileSanityMedia({
      payload: { find, update: mock(async () => ({})) } as never,
      client: client as never,
      collectionSlug: 'media',
      dryRun: true,
      limit: 10,
      maxRows: 15,
    })
    expect(report.scanned).toBe(15)
    expect(report.truncated).toBe(true)
    expect(report.nextPage).toBe(2)
    expect(client.getDocument).toHaveBeenCalledTimes(15)
  })

  test('a run that covers every row is not truncated', async () => {
    const find = pagedFind(7)
    const report = await reconcileSanityMedia({
      payload: { find, update: mock(async () => ({})) } as never,
      client: { getDocument: mock(async () => null) } as never,
      collectionSlug: 'media',
      dryRun: true,
      limit: 10,
      maxRows: 1000,
    })
    expect(report.scanned).toBe(7)
    expect(report.truncated).toBe(false)
    expect(report.nextPage).toBeNull()
  })

  test('startPage resumes a truncated run where it stopped', async () => {
    const find = pagedFind(25)
    const report = await reconcileSanityMedia({
      payload: { find, update: mock(async () => ({})) } as never,
      client: { getDocument: mock(async () => null) } as never,
      collectionSlug: 'media',
      dryRun: true,
      limit: 10,
      maxRows: 100,
      startPage: 3,
    })
    expect(find.mock.calls[0]?.[0]).toMatchObject({ page: 3 })
    expect(report.scanned).toBe(5)
  })

  test('upstream reads never exceed the concurrency bound', async () => {
    let inFlight = 0
    let peak = 0
    const client = {
      getDocument: mock(async () => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight -= 1
        return null
      }),
    }
    await reconcileSanityMedia({
      payload: { find: pagedFind(20), update: mock(async () => ({})) } as never,
      client: client as never,
      collectionSlug: 'media',
      dryRun: true,
      limit: 20,
      maxRows: 1000,
    })
    expect(peak).toBeLessThanOrEqual(RECONCILE_CONCURRENCY)
    expect(peak).toBeGreaterThan(1)
  })
})

describe('reconcile endpoint authorization and input bounds', () => {
  const requestWith = (body: string) => ({
    headers: new Headers(),
    text: async () => body,
    payload: {
      config: { collections: [] },
      find: mock(async () => ({ docs: [], hasNextPage: false })),
    },
    t: (key: string) => key,
  })

  test('a caller without update access is refused before any upstream call', async () => {
    const client = { getDocument: mock(async () => null) }
    const endpoint = createSanityReconcileEndpoint({
      client: client as never,
      collectionSlug: 'media',
      access: () => true,
      canUpdateMedia: async () => false,
    })
    const response = await endpoint.handler(requestWith('{}') as never)
    expect(response.status).toBe(403)
    expect(client.getDocument).not.toHaveBeenCalled()
  })

  test('maxRows above the hard cap is rejected', async () => {
    const endpoint = createSanityReconcileEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      access: () => true,
      canUpdateMedia: async () => true,
    })
    const response = await endpoint.handler(requestWith('{"maxRows":5001}') as never)
    expect(response.status).toBe(400)
  })

  test('canReconcileCollection requires update access and refuses an explicit false', () => {
    expect(canReconcileCollection({ collections: { media: { update: true } } }, 'media')).toBe(true)
    expect(canReconcileCollection({ collections: { media: { update: false } } }, 'media')).toBe(
      false
    )
    expect(canReconcileCollection({ collections: { media: { read: true } } }, 'media')).toBe(false)
    expect(canReconcileCollection(null, 'media')).toBe(false)
  })
})
