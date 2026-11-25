/**
 * The media delete guard must treat media embedded in rich text as a reference. Lexical stores
 * the link as an `upload` node inside JSON, which the relationship scan cannot see.
 * Runs the real guard hook and the real scanner against an in-memory data layer.
 */
import { describe, expect, test } from 'bun:test'
import type { SanitizedConfig } from 'payload'

import { createMediaReferenceIntegrityBeforeDeleteHook } from '@/features/media/lifecycle/delete/referenceIntegrity'
import { enTestT } from '../helpers/enTestT'

const config = {
  localization: { localeCodes: ['en'], defaultLocale: 'en' },
  admin: { user: 'users' },
  collections: [
    { slug: 'media', fields: [] },
    {
      slug: 'articles',
      labels: { singular: 'Article' },
      admin: { useAsTitle: 'title' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'body', type: 'richText' },
      ],
    },
  ],
  globals: [],
  routes: { admin: '/admin' },
} as unknown as SanitizedConfig

const embedding = {
  id: 'a-1',
  title: 'Launch',
  body: {
    root: {
      type: 'root',
      children: [{ type: 'upload', relationTo: 'media', value: { id: 10 }, version: 1 }],
    },
  },
}
const plain = { id: 'a-2', title: 'No media', body: { root: { type: 'root', children: [] } } }

function payloadWith(articles: unknown[]) {
  return {
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
    find: async (args: { collection: string }) =>
      args.collection === 'articles'
        ? { docs: articles, hasNextPage: false }
        : { docs: [], hasNextPage: false },
    findGlobal: async () => null,
    findVersions: async () => ({ docs: [] }),
    findGlobalVersions: async () => ({ docs: [] }),
    findByID: async () => ({ id: 10, filename: 'hero.jpg' }),
  }
}

describe('media delete guard counts rich text references', () => {
  const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')

  test('refuses deletion when a rich text body embeds the media', async () => {
    const req = {
      transactionID: 'tx-reference-test',
      payload: payloadWith([embedding]),
      user: { id: 'u1', collection: 'users' },
      t: enTestT,
      context: {},
    }
    await expect(hook({ id: 10, req } as never)).rejects.toBeDefined()
  })

  test('allows deletion when no rich text body embeds the media', async () => {
    const req = {
      transactionID: 'tx-reference-test',
      payload: payloadWith([plain]),
      user: { id: 'u1', collection: 'users' },
      t: enTestT,
      context: {},
    }
    await expect(hook({ id: 10, req } as never)).resolves.toBeUndefined()
  })
})
