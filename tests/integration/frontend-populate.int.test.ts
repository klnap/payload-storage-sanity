import { afterAll, describe, expect, it } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { BasePayload, buildConfig } from 'payload'
import { Client } from 'pg'
import sharp from 'sharp'
import { sanityStorage } from '../../src/plugin'
import { createSanityFixture, png, uploadFile } from '../helpers/sanityFixture'

/** 4x2 PNG, so a crop changes the stored dimensions. */
const wideSample = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWM4w2AMRwzIHABsegf5AK00nwAAAABJRU5ErkJggg==',
  'base64'
)

const baseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL?.trim()
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'

describe.skipIf(!baseUrl)('frontend populate with PostgreSQL and Local API', () => {
  const createdDatabases: string[] = []
  const started: BasePayload[] = []

  afterAll(async () => {
    for (const p of started) {
      await (p.db as unknown as { destroy?: () => Promise<void> }).destroy?.()
      await (p.db as unknown as { pool?: { end: () => Promise<void> } }).pool?.end()
    }
    if (createdDatabases.length === 0) return
    const adminUrl = new URL(baseUrl as string)
    adminUrl.pathname = '/postgres'
    const admin = new Client({ connectionString: adminUrl.toString() })
    await admin.connect()
    for (const database of createdDatabases) {
      await admin.query(`drop database if exists "${database}" with (force)`)
    }
    await admin.end()
  })

  async function startPayload(): Promise<{
    p: BasePayload
    fixture: ReturnType<typeof createSanityFixture>
  }> {
    const databaseName = `pss_frontend_${randomBytes(6).toString('hex')}`
    const adminUrl = new URL(baseUrl as string)
    adminUrl.pathname = '/postgres'
    const admin = new Client({ connectionString: adminUrl.toString() })
    await admin.connect()
    await admin.query(`create database "${databaseName}"`)
    await admin.end()
    createdDatabases.push(databaseName)

    const databaseUrl = new URL(baseUrl as string)
    databaseUrl.pathname = `/${databaseName}`
    const fixture = createSanityFixture()
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'synthetic-fixture-token',
      collections: { media: true },
      resolveFetch: fixture.resolveFetch,
    })
    const config = plugin({
      secret: `frontend-${randomBytes(8).toString('hex')}`,
      serverURL: 'http://frontend-populate.test',
      // Payload crops only when the config provides sharp.
      sharp,
      localization: {
        locales: [
          { code: 'pl', label: 'Polski' },
          { code: 'en', label: 'English' },
        ],
        defaultLocale: 'pl',
        fallback: true,
      },
      collections: [
        {
          slug: 'media',
          // Test-only: lets the crop test serve the CDN download through the global fetch it intercepts.
          upload: { disableLocalStorage: true, skipSafeFetch: true },
          access: { read: () => true },
          fields: [],
        },
        {
          slug: 'articles',
          access: { read: () => true },
          fields: [
            { name: 'title', type: 'text' },
            { name: 'hero', type: 'upload', relationTo: 'media' },
            {
              name: 'seo',
              type: 'group',
              fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
            },
          ],
        },
      ],
      globals: [
        {
          slug: 'home',
          access: { read: () => true },
          fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
        },
      ],
      db: postgresAdapter({
        idType: 'uuid',
        pool: { connectionString: databaseUrl.toString() },
        push: true,
      }),
    } as never)

    const p = new BasePayload()
    await p.init({ config: await buildConfig(config as never) })
    started.push(p)
    return { p, fixture }
  }

  it('returns locale-specific alt text without cross-language fallback and keeps explicit empties', async () => {
    const { p } = await startPayload()

    const photo = await p.create({
      collection: 'media',
      data: { alt: { pl: 'Opis zdjęcia', en: 'Photo caption' } },
      file: uploadFile(png, 'photo.png'),
    } as never)
    const onlyPolish = await p.create({
      collection: 'media',
      data: { alt: { pl: 'Tylko po polsku' } },
      file: uploadFile(png, 'polish-only.png'),
    } as never)
    const decorative = await p.create({
      collection: 'media',
      data: { alt: { pl: '' } },
      file: uploadFile(png, 'decorative.png'),
    } as never)

    const articleWithPhoto = await p.create({
      collection: 'articles',
      data: { title: 'With photo', hero: photo.id, seo: { image: photo.id } },
    } as never)
    const articleWithPolishOnly = await p.create({
      collection: 'articles',
      data: { title: 'Polish only', hero: onlyPolish.id },
    } as never)
    const articleWithDecorative = await p.create({
      collection: 'articles',
      data: { title: 'Decorative', hero: decorative.id },
    } as never)

    const readHero = async (id: string | number, locale: 'pl' | 'en') =>
      (
        (await p.findByID({
          collection: 'articles',
          id,
          locale,
          depth: 1,
          overrideAccess: true,
        })) as unknown as { hero: Record<string, unknown> }
      ).hero

    expect((await readHero(articleWithPhoto.id, 'pl')).alt).toBe('Opis zdjęcia')
    expect((await readHero(articleWithPhoto.id, 'en')).alt).toBe('Photo caption')
    expect((await readHero(articleWithPolishOnly.id, 'pl')).alt).toBe('Tylko po polsku')
    expect((await readHero(articleWithPolishOnly.id, 'en')).alt).toBeNull()
    expect((await readHero(articleWithDecorative.id, 'pl')).alt).toBe('')
    expect((await readHero(articleWithDecorative.id, 'en')).alt).toBeNull()

    const hero = await readHero(articleWithPhoto.id, 'en')
    expect(hero).toMatchObject({
      id: photo.id,
      url: expect.stringContaining('cdn.sanity.io'),
      focalX: 50,
      focalY: 50,
      alt: 'Photo caption',
    })
    expect(hero).not.toHaveProperty('sanity')
    expect(hero).not.toHaveProperty('sync')

    // A relation inside a group is populated at depth 1; group nesting is not relationship depth.
    const article = await p.findByID({
      collection: 'articles',
      id: articleWithPhoto.id,
      locale: 'en',
      depth: 1,
      overrideAccess: true,
    })
    expect((article as unknown as { seo: { image: { alt: unknown } } }).seo.image.alt).toBe(
      'Photo caption'
    )
  })

  it('persists focal point and returns it on the flat asset', async () => {
    const { p } = await startPayload()

    const photo = await p.create({
      collection: 'media',
      data: { alt: { pl: 'Ogniskowa' }, focalX: 20, focalY: 80 },
      file: uploadFile(png, 'focal.png'),
    } as never)
    const article = await p.create({
      collection: 'articles',
      data: { title: 'Focal', hero: photo.id },
    } as never)

    const stored = (await p.findByID({
      collection: 'media',
      id: photo.id,
      overrideAccess: true,
    })) as unknown as { focalX: number; focalY: number }
    expect(stored).toMatchObject({ focalX: 20, focalY: 80 })

    const populated = (await p.findByID({
      collection: 'articles',
      id: article.id,
      locale: 'pl',
      depth: 1,
      overrideAccess: true,
    })) as unknown as { hero: { focalX: number; focalY: number } }
    expect(populated.hero).toMatchObject({ focalX: 20, focalY: 80 })
  })

  it('persists a crop as new Sanity dimensions and returns them on the flat asset', async () => {
    const { p, fixture } = await startPayload()

    const photo = await p.create({
      collection: 'media',
      data: { alt: { en: 'Wide' }, focalX: 20, focalY: 80 },
      file: uploadFile(wideSample, 'wide.png'),
    } as never)
    const article = await p.create({
      collection: 'articles',
      data: { title: 'Crop', hero: photo.id },
    } as never)

    // Payload downloads the stored file from its URL before cropping; serve it from the fixture.
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.hostname === 'cdn.sanity.io') {
        const hash = /([a-f0-9]{40})/.exec(url.pathname)?.[1]
        const stored = hash ? fixture.bytes.get(hash) : undefined
        return stored
          ? new Response(new Uint8Array(stored), { headers: { 'content-type': 'image/png' } })
          : new Response(null, { status: 404 })
      }
      return realFetch(input, init)
    }) as typeof fetch
    let cropped: unknown
    try {
      cropped = await p.update({
        collection: 'media',
        id: photo.id,
        data: {},
        overrideAccess: true,
        // Payload reads crop edits from the query string, as the admin sends them.
        req: {
          query: {
            uploadEdits: {
              crop: { x: 0, y: 0, width: 2, height: 2 },
              widthInPixels: 2,
              heightInPixels: 2,
            },
          },
        } as never,
      } as never)
    } finally {
      globalThis.fetch = realFetch
    }

    const stored = (
      cropped as unknown as {
        sanity: { asset: { metadata: { dimensions: { width: number; height: number } } } }
      }
    ).sanity.asset.metadata.dimensions
    expect(stored).toMatchObject({ width: 2, height: 2 })

    const populated = (await p.findByID({
      collection: 'articles',
      id: article.id,
      locale: 'en',
      depth: 1,
      overrideAccess: true,
    })) as unknown as {
      hero: {
        id: string | number
        url: string
        width: number
        height: number
        aspectRatio: number
        focalX: number
        focalY: number
        alt: string | null
      }
    }
    expect(populated.hero).toMatchObject({
      id: photo.id,
      url: expect.stringContaining('cdn.sanity.io'),
      width: 2,
      height: 2,
      aspectRatio: 1,
      focalX: 20,
      focalY: 80,
      alt: 'Wide',
    })
  })

  it('populates a global relation with select at depth 1', async () => {
    const { p } = await startPayload()

    const photo = await p.create({
      collection: 'media',
      data: { alt: { pl: 'Globalny', en: 'Global' } },
      file: uploadFile(png, 'global.png'),
    } as never)
    await p.updateGlobal({
      slug: 'home',
      data: { image: photo.id },
      overrideAccess: true,
    } as never)

    const home = (await p.findGlobal({
      slug: 'home',
      locale: 'en',
      depth: 1,
      select: { image: true },
      overrideAccess: true,
    })) as unknown as { image: Record<string, unknown> }

    expect(home.image).toMatchObject({ id: photo.id, alt: 'Global' })
    expect(home.image).not.toHaveProperty('sanity')
  })

  it('returns the full media document to an authenticated request, not the flat asset', async () => {
    const { p } = await startPayload()

    const photo = await p.create({
      collection: 'media',
      data: { alt: { pl: 'Opis', en: 'Caption' } },
      file: uploadFile(png, 'auth.png'),
    } as never)
    const article = await p.create({
      collection: 'articles',
      data: { title: 'Auth', hero: photo.id },
    } as never)

    const authed = (await p.findByID({
      collection: 'articles',
      id: article.id,
      locale: 'en',
      depth: 1,
      overrideAccess: false,
      user: { id: 'editor-1', collection: 'users' } as never,
    })) as unknown as { hero: Record<string, unknown> }

    expect(authed.hero).toHaveProperty('sanity')
    expect(authed.hero).toHaveProperty('sync')
  })
})
