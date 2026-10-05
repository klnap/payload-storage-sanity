import { describe, expect, test } from 'bun:test'

import { shouldApplyDefaultPopulate } from '../../../src/populate/shouldApplyDefaultPopulate.js'

const restReq = (url: string) =>
  ({ url, payloadAPI: 'REST' }) as never

const localReq = (url?: string) =>
  ({ url, payloadAPI: 'local' }) as never

describe('shouldApplyDefaultPopulate', () => {
  test('returns false for direct GET /api/media/:id (numeric)', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        req: restReq('http://localhost:3000/api/media/42'),
      })
    ).toBe(false)
  })

  test('returns false for direct GET /api/media/:id (UUID)', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        req: restReq(
          'http://localhost:3000/api/media/0babf185-2616-41ab-9fb0-1a7f752f5af8?locale=pl&depth=0'
        ),
      })
    ).toBe(false)
  })

  test('returns true for collection REST sub-routes (e.g. versions)', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        req: restReq('http://localhost:3000/api/media/versions'),
      })
    ).toBe(true)
  })

  test('returns false for direct GET /api/media list', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        req: restReq('http://localhost:3000/api/media?limit=10'),
      })
    ).toBe(false)
  })

  test('returns true for nested populate on REST', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        req: restReq('http://localhost:3000/api/globals/test?depth=1'),
      })
    ).toBe(true)
  })

  test('returns false for admin local API (document edit)', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        req: localReq('http://localhost:3000/api/globals/test'),
      })
    ).toBe(false)
  })

  test('returns true for REST depth populate batched via find (dataloader)', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        findMany: true,
        req: restReq('http://localhost:3000/api/globals/test?depth=1'),
      })
    ).toBe(true)
  })

  test('respects sanitySkipDefaultPopulate context flag', () => {
    expect(
      shouldApplyDefaultPopulate({
        context: { sanitySkipDefaultPopulate: true },
        collectionSlug: 'media',
        req: restReq('http://localhost:3000/api/globals/test'),
      })
    ).toBe(false)
  })

  test('sanitySkipDefaultPopulate on direct REST document route', () => {
    expect(
      shouldApplyDefaultPopulate({
        context: { sanitySkipDefaultPopulate: true },
        collectionSlug: 'media',
        req: restReq(
          'http://localhost:3000/api/media/0babf185-2616-41ab-9fb0-1a7f752f5af8'
        ),
      })
    ).toBe(false)
  })

  test('respects sanityForceDefaultPopulate context flag on local API', () => {
    expect(
      shouldApplyDefaultPopulate({
        context: { sanityForceDefaultPopulate: true },
        collectionSlug: 'media',
        req: localReq('http://localhost:3000/api/media/42'),
      })
    ).toBe(true)
  })
})
