import { describe, expect, mock, test } from 'bun:test'
import { markMediaBySanityAssetId } from './markMedia'

/** Reads `overrideAccess` from the first call of a Payload stub. */
const firstOverrideAccess = (fn: { mock: { calls: unknown[][] } }): boolean | undefined => {
  const [arg] = fn.mock.calls[0] ?? []
  return (arg as { overrideAccess?: boolean } | undefined)?.overrideAccess
}

const matchingRow = { id: 7, sync: { status: 'available' } }

function payloadStub() {
  const findByID = mock(async () => matchingRow)
  const update = mock(async () => ({}))
  return {
    findByID,
    update,
    payload: {
      findByID,
      update,
      find: mock(async () => ({ docs: [matchingRow], hasNextPage: false })),
    } as never,
  }
}

describe('markMediaBySanityAssetId access mode', () => {
  test('webhook path (default) keeps system access', async () => {
    const { payload, findByID, update } = payloadStub()
    await markMediaBySanityAssetId({
      payload,
      collectionSlug: 'media',
      sanityAssetId: 'image-x',
      status: 'missing',
    })
    expect(firstOverrideAccess(findByID)).toBe(true)
    expect(firstOverrideAccess(update)).toBe(true)
  })

  test('reconcile path (enforceAccess) runs under the caller access', async () => {
    const { payload, findByID, update } = payloadStub()
    await markMediaBySanityAssetId({
      payload,
      collectionSlug: 'media',
      sanityAssetId: 'image-x',
      status: 'missing',
      enforceAccess: true,
    })
    expect(firstOverrideAccess(findByID)).toBe(false)
    expect(firstOverrideAccess(update)).toBe(false)
  })
})
