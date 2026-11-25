import { describe, expect, mock, test } from 'bun:test'
import type { PayloadRequest } from 'payload'

import { findMediaBySanityAssetId } from './findMediaBySanityAssetId'

function requestWith(
  docsPerCall: Array<Array<{ id: number }>>,
  user: object | null
): { req: PayloadRequest; find: ReturnType<typeof mock> } {
  const find = mock()
  for (const docs of docsPerCall) {
    find.mockResolvedValueOnce({ docs })
  }
  const req = { payload: { find }, user } as unknown as PayloadRequest
  return { req, find }
}

describe('findMediaBySanityAssetId', () => {
  test('returns the id when the requester can read the existing row', async () => {
    const { req } = requestWith([[{ id: 42 }], [{ id: 42 }]], { id: 'editor' })

    const result = await findMediaBySanityAssetId(req, 'media', 'image-abc-1x1-png')

    expect(result).toEqual({ id: 42 })
  })

  test('returns a null id when the existing row is not readable by the requester', async () => {
    const { req } = requestWith([[{ id: 42 }], []], { id: 'editor' })

    const result = await findMediaBySanityAssetId(req, 'media', 'image-abc-1x1-png')

    expect(result).toEqual({ id: null })
  })

  test('scopes the readable lookup to the requester', async () => {
    const { req, find } = requestWith([[{ id: 42 }], [{ id: 42 }]], { id: 'editor' })

    await findMediaBySanityAssetId(req, 'media', 'image-abc-1x1-png')

    expect(find.mock.calls[0]?.[0]).toMatchObject({ overrideAccess: true })
    expect(find.mock.calls[1]?.[0]).toMatchObject({ overrideAccess: false })
  })

  test('a request without a user gets the id only when its own access reads the row', async () => {
    // The existence probe is privileged; the readability check is not, so an anonymous request
    // never receives the id of a row it cannot read.
    const { req, find } = requestWith([[{ id: 42 }], [{ id: 42 }]], null)

    const result = await findMediaBySanityAssetId(req, 'media', 'image-abc-1x1-png')

    expect(result).toEqual({ id: 42 })
    expect(find.mock.calls[1]?.[0]).toMatchObject({ overrideAccess: false })
  })

  test('an unreadable row is reported without its id', async () => {
    const { req } = requestWith([[{ id: 42 }], []], null)

    const result = await findMediaBySanityAssetId(req, 'media', 'image-abc-1x1-png')

    expect(result).toEqual({ id: null })
  })

  test('returns null when no row references the asset', async () => {
    const { req, find } = requestWith([[]], { id: 'editor' })

    const result = await findMediaBySanityAssetId(req, 'media', 'image-abc-1x1-png')

    expect(result).toBeNull()
    expect(find).toHaveBeenCalledTimes(1)
  })
})
