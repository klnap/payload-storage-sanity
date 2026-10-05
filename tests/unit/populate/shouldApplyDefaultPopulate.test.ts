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

  test('returns true for collection REST sub-routes (e.g. versions) when batched', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        findMany: true,
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
        findMany: true,
        req: restReq('http://localhost:3000/api/globals/test?depth=1'),
      })
    ).toBe(true)
  })

  test('returns false for nested populate when request is authenticated (admin editor)', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        findMany: true,
        req: {
          ...restReq('http://localhost:3000/api/globals/test?depth=1'),
          user: { id: '1', collection: 'users' },
        } as never,
      })
    ).toBe(false)
  })

  test('returns true for nested populate on Local API (e.g. findGlobal)', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        findMany: true,
        req: localReq('http://localhost:3000/api/globals/home-page?depth=1'),
      })
    ).toBe(true)
  })

  test('returns false for admin document load without findMany batch', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        req: localReq('http://localhost:3000/admin/collections/media/07c5141a-df0f-4593-8953-0c9e523c3e7c'),
      })
    ).toBe(false)
  })

  test('returns false for admin collection list even when findMany is true', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        findMany: true,
        req: localReq('http://localhost:3000/admin/collections/media'),
      })
    ).toBe(false)
  })

  test('returns false for direct Local API GET /api/media/:id (admin editor)', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        req: localReq('http://localhost:3000/api/media/42'),
      })
    ).toBe(false)
  })

  test('returns false on Local API when localPopulate is disabled', () => {
    expect(
      shouldApplyDefaultPopulate({
        collectionSlug: 'media',
        localPopulate: false,
        req: localReq('http://localhost:3000/api/globals/home-page'),
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

  test('respects context.sanityStorage.skipPopulate', () => {
    expect(
      shouldApplyDefaultPopulate({
        context: { sanityStorage: { skipPopulate: true } },
        collectionSlug: 'media',
        req: restReq('http://localhost:3000/api/globals/test'),
      })
    ).toBe(false)
  })

  test('skipPopulate on direct REST document route', () => {
    expect(
      shouldApplyDefaultPopulate({
        context: { sanityStorage: { skipPopulate: true } },
        collectionSlug: 'media',
        req: restReq(
          'http://localhost:3000/api/media/0babf185-2616-41ab-9fb0-1a7f752f5af8'
        ),
      })
    ).toBe(false)
  })

  test('respects context.sanityStorage.forcePopulate on local API', () => {
    expect(
      shouldApplyDefaultPopulate({
        context: { sanityStorage: { forcePopulate: true } },
        collectionSlug: 'media',
        req: localReq('http://localhost:3000/api/media/42'),
      })
    ).toBe(true)
  })

  test('forcePopulate does not bypass authenticated admin reads', () => {
    expect(
      shouldApplyDefaultPopulate({
        context: { sanityStorage: { forcePopulate: true } },
        collectionSlug: 'media',
        findMany: true,
        req: {
          ...restReq('http://localhost:3000/api/globals/test?depth=1'),
          user: { id: 'admin-1', collection: 'users' },
        } as never,
      })
    ).toBe(false)
  })
})
