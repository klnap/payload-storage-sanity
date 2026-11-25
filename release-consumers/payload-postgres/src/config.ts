import { sanityStorage } from '@klnap/payload-storage-sanity'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'

export const config = buildConfig({
  secret: 'standalone-storage-postgres-fixture-secret',
  db: postgresAdapter({
    idType: 'uuid',
    pool: { connectionString: process.env.PSS_POSTGRES_CONSUMER_DATABASE_URL },
    push: true,
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
    {
      slug: 'articles',
      access: {
        create: () => true,
        read: () => true,
        update: () => true,
        delete: () => true,
      },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'cover', type: 'relationship', relationTo: 'media' },
      ],
    },
  ],
  plugins: [
    sanityStorage({
      projectId: 'fixture',
      dataset: 'production',
      token: 'fixture-token',
      collections: { media: true },
      resolveFetch: () => globalThis.fetch,
    }),
  ],
})
