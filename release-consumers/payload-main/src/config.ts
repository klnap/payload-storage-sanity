import { sanityStorage } from '@klnap/payload-storage-sanity'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig } from 'payload'

export const config = buildConfig({
  secret: 'standalone-storage-runtime-fixture-secret',
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URL ?? 'file:./payload-storage-runtime-fixture.sqlite' },
  }),
  collections: [
    {
      slug: 'media',
      upload: true,
      access: {
        create: () => true,
        read: () => true,
        update: () => true,
        delete: () => true,
      },
      fields: [{ name: 'alt', type: 'text' }],
    },
  ],
  plugins: [
    sanityStorage({
      projectId: 'fixture',
      dataset: 'production',
      token: 'fixture-token',
      collections: { media: true },
      dedupeUploads: true,
      resolveFetch: () => globalThis.fetch,
    }),
  ],
})
