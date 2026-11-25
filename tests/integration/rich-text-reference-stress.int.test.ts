/**
 * Concurrent rich-text reference writes and media deletes, through the real `sanityStorage` plugin, on two
 * independent host configurations. Invariant after the storm: no committed rich-text document embeds a media
 * row that no longer exists. Each operation is its own Payload transaction, so the interleavings are real.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import {
  BasePayload,
  buildConfig,
  type CollectionConfig,
  type GlobalConfig,
  type Payload,
} from 'payload'
import { Client } from 'pg'
import { sanityStorage } from '../../src/plugin'

const baseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL?.trim()
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'

const embed = (mediaSlug: string, ids: string[]) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: ids.map((value) => ({
      type: 'upload',
      relationTo: mediaSlug,
      value,
      version: 1,
      format: '',
      fields: null,
    })),
  },
})

const mediaFile = (n: number) => ({
  data: Buffer.from(`asset-${n}`),
  mimetype: 'text/plain',
  name: `asset-${n}-${randomBytes(3).toString('hex')}.txt`,
  size: 7,
})

type HostConfig = {
  name: string
  mediaSlug: string
  collections: CollectionConfig[]
  globals: GlobalConfig[]
  /** Writes a rich-text document that embeds `ids`, returns true when it committed. */
  writeReference: (payload: Payload, ids: string[]) => Promise<void>
  /** Collects every rich-text embed id stored in the host, for the invariant check. */
  embeddedIds: (payload: Payload) => Promise<string[]>
}

const hostConfigs = (): HostConfig[] => {
  const defaultHost: HostConfig = {
    name: 'default host (media, articles)',
    mediaSlug: 'media',
    collections: [
      { slug: 'media', upload: { disableLocalStorage: true }, fields: [] },
      {
        slug: 'articles',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'body', type: 'richText' },
        ],
      },
    ],
    globals: [],
    writeReference: async (payload, ids) => {
      await payload.create({
        collection: 'articles',
        data: { title: 'a', body: embed('media', ids) as never },
        overrideAccess: true,
      })
    },
    embeddedIds: async (payload) => {
      const docs = await payload.find({
        collection: 'articles',
        limit: 1000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      })
      return docs.docs.flatMap((doc) => embeddedIn((doc as { body?: unknown }).body, 'media'))
    },
  }

  const customHost: HostConfig = {
    name: 'custom host (assets slug, drafts, global, array rich text)',
    mediaSlug: 'assets',
    collections: [
      { slug: 'assets', upload: { disableLocalStorage: true }, fields: [] },
      {
        slug: 'pages',
        versions: { drafts: true },
        fields: [
          { name: 'title', type: 'text' },
          {
            name: 'blocks',
            type: 'array',
            fields: [{ name: 'copy', type: 'richText' }],
          },
        ],
      },
    ],
    globals: [{ slug: 'site', fields: [{ name: 'footer', type: 'richText' }] }],
    writeReference: async (payload, ids) => {
      const roll = Math.random()
      if (roll < 0.5) {
        await payload.create({
          collection: 'pages',
          data: { title: 'p', blocks: [{ copy: embed('assets', ids) }] } as never,
          draft: true,
          overrideAccess: true,
        })
      } else {
        await payload.updateGlobal({
          slug: 'site',
          data: { footer: embed('assets', ids) } as never,
          overrideAccess: true,
        })
      }
    },
    embeddedIds: async (payload) => {
      const pages = await payload.find({
        collection: 'pages',
        limit: 1000,
        depth: 0,
        draft: true,
        overrideAccess: true,
        pagination: false,
      })
      const ids = pages.docs.flatMap((doc) =>
        ((doc as { blocks?: Array<{ copy?: unknown }> }).blocks ?? []).flatMap((block) =>
          embeddedIn(block.copy, 'assets')
        )
      )
      const site = await payload.findGlobal({ slug: 'site', depth: 0, overrideAccess: true })
      return [...ids, ...embeddedIn((site as { footer?: unknown }).footer, 'assets')]
    },
  }

  return [defaultHost, customHost]
}

/** Upload-node ids of a Lexical tree for one media slug. */
function embeddedIn(value: unknown, slug: string): string[] {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (typeof node !== 'object' || node === null) return
    const record = node as Record<string, unknown>
    if (record.type === 'upload' && record.relationTo === slug) {
      const raw = record.value
      out.push(String(typeof raw === 'object' && raw !== null ? (raw as { id: unknown }).id : raw))
    }
    Object.values(record).forEach(walk)
  }
  walk(value)
  return out
}

const configuredHosts = hostConfigs()

describe.skipIf(!baseUrl)('rich-text reference storm (postgres, real plugin)', () => {
  let adminUrl = ''
  const created: string[] = []

  beforeAll(() => {
    adminUrl = new URL(baseUrl as string).toString()
  })

  afterAll(async () => {
    const admin = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/postgres') })
    await admin.connect()
    for (const database of created)
      await admin.query(`drop database if exists "${database}" with (force)`)
    await admin.end()
  })

  for (const host of configuredHosts) {
    it(`no committed rich text embeds a deleted media row under concurrent writes and deletes: ${host.name}`, async () => {
      const databaseName = `pss_storm_${randomBytes(6).toString('hex')}`
      const admin = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/postgres') })
      await admin.connect()
      await admin.query(`create database "${databaseName}"`)
      await admin.end()
      created.push(databaseName)
      const isolated = new URL(adminUrl)
      isolated.pathname = `/${databaseName}`

      const storage = sanityStorage({
        projectId: 'demo',
        dataset: 'production',
        token: 'token',
        collections: { [host.mediaSlug]: true },
        // Schema and reference hooks only: no upstream upload from this test (the sandbox has no network).
        mode: 'fields-only',
      })
      const plugged = storage({
        secret: `storm-${randomBytes(8).toString('hex')}`,
        serverURL: 'http://storm.test',
        editor: lexicalEditor(),
        collections: host.collections,
        globals: host.globals,
        db: postgresAdapter({
          idType: 'uuid',
          pool: { connectionString: isolated.toString() },
          push: true,
        }),
      } as never)
      const payload = new BasePayload()
      await payload.init({ config: await buildConfig(plugged as never) })

      let counts = { writesCommitted: 0, writesRefused: 0, deletesCommitted: 0, deletesRefused: 0 }
      try {
        const mediaIds: string[] = []
        for (let n = 1; n <= 8; n += 1) {
          const media = await payload.create({
            collection: host.mediaSlug as never,
            data: { alt: `m${n}` } as never,
            file: mediaFile(n),
            overrideAccess: true,
          })
          mediaIds.push(String((media as { id: unknown }).id))
        }

        counts = { writesCommitted: 0, writesRefused: 0, deletesCommitted: 0, deletesRefused: 0 }
        const storm: Array<Promise<unknown>> = []
        for (let i = 0; i < 40; i += 1) {
          const pick = () => mediaIds[Math.floor(Math.random() * mediaIds.length)] as string
          if (i % 4 === 0) {
            const id = mediaIds[i % mediaIds.length] as string
            storm.push(
              payload
                .delete({ collection: host.mediaSlug as never, id, overrideAccess: true })
                .then(
                  () => counts.deletesCommitted++,
                  () => counts.deletesRefused++
                )
            )
          } else {
            const ids = [pick(), pick()]
            storm.push(
              host.writeReference(payload, ids).then(
                () => counts.writesCommitted++,
                () => counts.writesRefused++
              )
            )
          }
        }
        await Promise.allSettled(storm)
        console.log(`STORM ${host.name}: ${JSON.stringify(counts)}`)

        const remaining = new Set(
          (
            await payload.find({
              collection: host.mediaSlug as never,
              limit: 1000,
              depth: 0,
              overrideAccess: true,
              pagination: false,
            })
          ).docs.map((doc) => String((doc as { id: unknown }).id))
        )
        const embedded = await host.embeddedIds(payload)
        const dangling = embedded.filter((id) => !remaining.has(id))
        expect(dangling).toEqual([])
        expect(embedded.length).toBeGreaterThan(0)
        // The storm must have exercised both sides of the race, or the invariant proves nothing.
        expect(counts.writesCommitted).toBeGreaterThan(0)
        expect(counts.deletesCommitted + counts.deletesRefused).toBeGreaterThan(0)
      } finally {
        await (payload.db as unknown as { destroy?: () => Promise<void> }).destroy?.()
        await (payload.db as unknown as { pool?: { end: () => Promise<void> } }).pool?.end()
      }
    }, 240_000)
  }
})
