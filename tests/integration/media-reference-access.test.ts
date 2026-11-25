/**
 * H1 regression: the media delete guard must see every reference regardless of the deleter's
 * read access, while the user-visible usage listing must only show readable documents.
 *
 * Runs the real delete hook, real reference scanner and real message formatters against a
 * data layer that enforces read access the way Payload does for `overrideAccess: false`.
 */
import { describe, expect, test } from 'bun:test'
import { APIError, type SanitizedConfig } from 'payload'

import { createMediaReferenceIntegrityBeforeDeleteHook } from '@/features/media/lifecycle/delete/referenceIntegrity'
import { SANITY_STORAGE_CONTEXT_KEY } from '@/features/media/populate/requestContext'
import { createMediaUsageEndpoint } from '@/features/media/usage'
import { enTestT } from '../helpers/enTestT'

const config = {
  localization: { localeCodes: ['en'], defaultLocale: 'en' },
  admin: { user: 'users' },
  collections: [
    { slug: 'media', fields: [] },
    {
      slug: 'posts',
      labels: { singular: 'Post' },
      admin: { useAsTitle: 'title' },
      fields: [{ name: 'cover', type: 'upload', relationTo: 'media', label: 'Cover' }],
    },
  ],
  globals: [],
  routes: { admin: '/admin' },
} as unknown as SanitizedConfig

const SECRET_POST = { id: 'post-secret-77', title: 'Confidential launch plan', cover: 10 }

type Caller = { id: string; collection: 'users'; canReadPosts: boolean }
const mediaManager: Caller = { id: 'u-media', collection: 'users', canReadPosts: false }
const editor: Caller = { id: 'u-editor', collection: 'users', canReadPosts: true }

/** Payload-like data layer: `overrideAccess: false` applies the requester's read access. */
function makePayload() {
  const overrideFlags: Array<boolean | undefined> = []
  const payload = {
    config,
    db: {
      packageName: '@payloadcms/db-postgres',
      sessions: {
        'tx-reference-test': {
          db: {
            execute: async (query: string) =>
              query === 'show transaction_isolation'
                ? { rows: [{ transaction_isolation: 'read committed' }] }
                : { rows: [] },
          },
        },
      },
    },
    logger: { error: () => {} },
    find: async (args: {
      collection: string
      overrideAccess?: boolean
      req?: { user?: Caller | null }
    }) => {
      overrideFlags.push(args.overrideAccess)
      if (args.collection !== 'posts') return { docs: [] }
      const privileged = args.overrideAccess !== false
      const readable = privileged || args.req?.user?.canReadPosts === true
      return { docs: readable ? [SECRET_POST] : [] }
    },
    findGlobal: async () => null,
    findVersions: async () => ({ docs: [] }),
    findGlobalVersions: async () => ({ docs: [] }),
    findByID: async () => ({ id: 10, filename: 'hero.jpg' }),
  }
  return { payload, overrideFlags }
}

function expectNoSecretMetadata(text: string) {
  expect(text).not.toContain(SECRET_POST.title)
  expect(text).not.toContain(SECRET_POST.id)
  expect(text).not.toContain('/admin/collections/posts')
}

describe('media delete guard (privileged reference integrity)', () => {
  const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')

  test('blocks deletion when a reference exists that the deleter cannot read', async () => {
    const { payload, overrideFlags } = makePayload()
    const req = {
      payload,
      transactionID: 'tx-reference-test',
      user: mediaManager,
      t: enTestT,
      context: {},
    }

    let thrown: unknown
    try {
      await hook({ id: 10, req } as never)
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(APIError)
    // The scan ran privileged: every reference lookup used overrideAccess true.
    expect(overrideFlags.length).toBeGreaterThan(0)
    expect(overrideFlags.every((flag) => flag === true)).toBe(true)
    // The message carries a count only, never the inaccessible document's metadata.
    expectNoSecretMetadata((thrown as Error).message)
    expectNoSecretMetadata(JSON.stringify((thrown as APIError).data ?? {}))
  })

  test('bulk delete message also avoids inaccessible metadata', async () => {
    const { payload } = makePayload()
    const req = {
      payload,
      transactionID: 'tx-reference-test',
      user: mediaManager,
      t: enTestT,
      context: { [SANITY_STORAGE_CONTEXT_KEY]: { bulkDelete: true } },
    }

    let thrown: unknown
    try {
      await hook({ id: 10, req } as never)
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(APIError)
    expect((thrown as APIError).data).toMatchObject({ referenceCount: 1 })
    expectNoSecretMetadata((thrown as Error).message)
  })

  test('system deletes without a user are still guarded', async () => {
    const { payload } = makePayload()
    const req = {
      payload,
      transactionID: 'tx-reference-test',
      user: null,
      t: enTestT,
      context: {},
    }
    await expect(hook({ id: 10, req } as never)).rejects.toBeInstanceOf(APIError)
  })
})

describe('media usage endpoint (requester-scoped listing)', () => {
  const endpoint = createMediaUsageEndpoint({ mediaCollectionSlug: 'media' })

  async function usagesFor(user: Caller) {
    const { payload, overrideFlags } = makePayload()
    const res = await endpoint.handler({
      routeParams: { id: '10' },
      user,
      payload,
      t: enTestT,
    } as never)
    const body = (await res.json()) as { usages?: Array<{ title?: string; id?: unknown }> }
    return { res, body, overrideFlags }
  }

  test('does not disclose documents the requester cannot read', async () => {
    const { res, body, overrideFlags } = await usagesFor(mediaManager)
    expect(res.status).toBe(200)
    expect(body.usages).toEqual([])
    expect(overrideFlags.every((flag) => flag === false)).toBe(true)
    expectNoSecretMetadata(JSON.stringify(body))
  })

  test('still lists usages for an editor who can read the referencing document', async () => {
    const { res, body } = await usagesFor(editor)
    expect(res.status).toBe(200)
    expect(body.usages?.map((u) => u.title)).toEqual([SECRET_POST.title])
  })
})
