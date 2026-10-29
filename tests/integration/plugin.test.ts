import { describe, expect, test } from 'bun:test'
import type { CollectionConfig, Config, Field } from 'payload'

import { sanityStorage } from '../../src/plugin'
import { enTestT } from '../helpers/enTestT'

function collectFields(fields: Field[] | undefined): Field[] {
  if (!fields) return []
  const out: Field[] = []
  for (const field of fields) {
    if (field.type === 'tabs' && 'tabs' in field && Array.isArray(field.tabs)) {
      for (const tab of field.tabs) {
        out.push(...collectFields(tab.fields))
      }
      continue
    }
    if (field.type === 'row' && 'fields' in field && Array.isArray(field.fields)) {
      out.push(...collectFields(field.fields))
      continue
    }
    out.push(field)
  }
  return out
}

function findMediaField(
  media: CollectionConfig | undefined,
  name: string,
  type?: Field['type']
): Field | undefined {
  return collectFields(media?.fields).find(
    (f) => 'name' in f && f.name === name && (type == null || f.type === type)
  )
}

function applyPlugin(collections: Config['collections']): Config {
  return applyPluginOptions(collections)
}

function applyPluginOptions(
  collections: Config['collections'],
  options: Omit<Parameters<typeof sanityStorage>[0], 'collections'> & {
    collections?: Record<string, true>
  } = {}
): Config {
  const plugin = sanityStorage({
    projectId: 'demo',
    dataset: 'production',
    token: 'token',
    collections: { media: true },
    ...options,
  })

  const incoming = {
    secret: 'test',
    db: {} as Config['db'],
    collections,
  } as Config

  const result = plugin(incoming)
  if (result instanceof Promise) {
    throw new Error('expected sync plugin result')
  }
  return result
}

describe('sanityStorage', () => {
  test('sets defaultPopulate and forceSelect on media collections for preset default', () => {
    const config = applyPlugin([{ slug: 'media', upload: true, fields: [] }])
    const media = config.collections?.find((c) => c.slug === 'media')

    expect(media?.defaultPopulate).toMatchObject({
      id: true,
      url: true,
      focalX: true,
      sanity: { asset: { metadata: { dimensions: true, lqip: true } } },
    })
    expect(media?.forceSelect).toMatchObject({
      sanity: { asset: { metadata: { dimensions: true, lqip: true } } },
      alt: true,
      sync: true,
      url: true,
      width: true,
    })
  })

  test('defaults list columns and admin thumbnail for upload collections', () => {
    const config = applyPlugin([{ slug: 'media', upload: true, fields: [] }])
    const media = config.collections?.find((c) => c.slug === 'media')

    expect(media).toBeDefined()
    expect(media!.admin?.defaultColumns).toEqual(['filename', 'id', 'updatedAt'])
    expect(media!.admin?.useAsTitle).toBe('id')

    const upload = media!.upload
    expect(typeof upload).toBe('object')
    expect(typeof (upload as { adminThumbnail?: unknown }).adminThumbnail).toBe('function')
    expect((upload as { displayPreview?: boolean }).displayPreview).toBe(true)
    expect(media?.fields?.some((f) => 'name' in f && f.name === 'sanityStablePreview')).toBe(false)
    expect(media?.fields?.some((f) => 'name' in f && f.name === 'sanityAssetList')).toBe(false)
  })

  test('sets disableLocalStorage on configured upload collections', () => {
    const config = applyPlugin([
      { slug: 'media', upload: true, fields: [] },
      { slug: 'pages', fields: [] },
    ])

    const media = config.collections?.find((c) => c.slug === 'media')
    expect(media?.upload).toMatchObject({
      disableLocalStorage: true,
      crop: false,
      focalPoint: false,
    })
    const uploadConfig = media?.upload
    expect((uploadConfig as { imageSizes?: unknown }).imageSizes).toEqual([])

    const pages = config.collections?.find((c) => c.slug === 'pages')
    expect(pages?.upload).toBeUndefined()
  })

  test('forces imageSizes to [] even when the collection defines imageSizes', () => {
    const config = applyPlugin([
      {
        slug: 'media',
        upload: {
          imageSizes: [{ name: 'thumbnail', width: 400, height: 300 }],
        },
        fields: [],
      },
    ])
    const media = config.collections?.find((c) => c.slug === 'media')
    expect((media?.upload as { imageSizes?: unknown })?.imageSizes).toEqual([])
  })

  test('raises Payload upload fileSize from uploadMaxSize limits', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      uploadMaxSize: { default: 10, byType: { video: 500 } },
      collections: { media: true },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    expect(config.upload?.limits?.fileSize).toBe(500)
  })

  test('injects plain alt text field when localization locales are missing', () => {
    const config = applyPlugin([{ slug: 'media', upload: true, fields: [] }])
    const media = config.collections?.find((c) => c.slug === 'media')
    const altGroup = findMediaField(media, 'alt', 'group')
    const altText = findMediaField(media, 'alt', 'text')
    expect(altGroup).toBeUndefined()
    expect(altText).toBeDefined()
  })

  test('injects alt group when collections.media is true shorthand and localization is set', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      localization: {
        locales: [
          { code: 'pl', label: 'Polish' },
          { code: 'en', label: 'English' },
        ],
        defaultLocale: 'pl',
      },
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const altField = findMediaField(media, 'alt', 'group') as
      | { fields?: { name: string }[] }
      | undefined

    expect(altField).toBeDefined()
    expect(altField?.fields?.map((f) => f.name)).toEqual(['pl', 'en'])
    const plField = altField?.fields?.find((f) => f.name === 'pl')
    expect(plField).toMatchObject({ required: false })
  })

  test('skips alt injection when alt.enabled is false', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: { alt: { enabled: false } } },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      localization: {
        locales: [{ code: 'pl' }],
        defaultLocale: 'pl',
      },
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as unknown as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const altField = media?.fields?.find(
      (f) => 'name' in f && f.name === 'alt' && f.type === 'group'
    )
    expect(altField).toBeUndefined()
  })

  test('sets required on locale subfields when alt.required is true', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: { alt: { required: true } } },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      localization: {
        locales: [{ code: 'pl' }, { code: 'en' }],
        defaultLocale: 'pl',
      },
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as unknown as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const altField = findMediaField(media, 'alt', 'group') as
      | { fields?: { required?: boolean }[] }
      | undefined

    expect(altField?.fields?.every((f) => f.required === true)).toBe(true)
  })

  test('skips alt injection when collection already defines alt', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      localization: {
        locales: [{ code: 'pl' }],
        defaultLocale: 'pl',
      },
      collections: [
        {
          slug: 'media',
          upload: true,
          fields: [{ name: 'alt', type: 'text', localized: true }],
        },
      ],
    } as unknown as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const altOnCollection = findMediaField(media, 'alt')
    expect(altOnCollection).toBeDefined()
    expect(altOnCollection?.type).toBe('text')
  })

  test('respects crop and focalPoint from collection upload config', () => {
    const config = applyPlugin([
      {
        slug: 'media',
        upload: { crop: true, focalPoint: true, staticDir: 'media' },
        fields: [],
      },
    ])

    const media = config.collections?.find((c) => c.slug === 'media')
    expect(media?.upload).toMatchObject({
      crop: true,
      focalPoint: true,
    })
  })

  test('respects disableLocalStorage override', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: { disableLocalStorage: false } },
    })

    const result = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: { staticDir: 'media' }, fields: [] }],
    } as Config)

    if (result instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = result.collections?.find((c) => c.slug === 'media')
    expect(media?.upload).toMatchObject({ disableLocalStorage: false })
  })

  test('registers webhook and reconcile endpoints when sync is enabled', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
      sync: {
        enabled: true,
        webhook: { secret: 'secret' },
      },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const paths = (config.endpoints ?? []).map((endpoint) => endpoint.path)
    expect(paths).toContain('/sanity-storage/webhook')
    expect(paths).toContain('/sanity-storage/reconcile')
  })

  test('does not register sync endpoints when sync is disabled', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
      sync: {
        webhook: { secret: 'secret' },
      },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const paths = (config.endpoints ?? []).map((endpoint) => endpoint.path)
    expect(paths).not.toContain('/sanity-storage/webhook')
    expect(paths).not.toContain('/sanity-storage/reconcile')
  })

  test('replaces cloud-storage afterChange tail with chained upload rollback hook in full mode', () => {
    const config = applyPlugin([{ slug: 'media', upload: true, fields: [] }])
    const media = config.collections?.find((c) => c.slug === 'media')
    const afterChangeHooks = media?.hooks?.afterChange ?? []

    // No user afterChange hooks: cloud-storage registers one hook; sanity replaces it with a single chain.
    expect(afterChangeHooks.length).toBe(1)
  })

  test('registers dedupe hooks only when dedupeUploads is true', () => {
    const withDefault = applyPlugin([{ slug: 'media', upload: true, fields: [] }])
    const withDedupe = applyPluginOptions([{ slug: 'media', upload: true, fields: [] }], {
      dedupeUploads: true,
    })
    const withoutDedupe = applyPluginOptions([{ slug: 'media', upload: true, fields: [] }], {
      dedupeUploads: false,
    })

    const defaultMedia = withDefault.collections?.find((c) => c.slug === 'media')
    const onMedia = withDedupe.collections?.find((c) => c.slug === 'media')
    const offMedia = withoutDedupe.collections?.find((c) => c.slug === 'media')

    expect(defaultMedia?.hooks?.beforeChange?.length ?? 0).toBe(
      offMedia?.hooks?.beforeChange?.length ?? 0
    )
    expect(defaultMedia?.hooks?.afterOperation?.length ?? 0).toBe(
      offMedia?.hooks?.afterOperation?.length ?? 0
    )
    expect(onMedia?.hooks?.beforeChange?.length ?? 0).toBeGreaterThan(
      offMedia?.hooks?.beforeChange?.length ?? 0
    )
    expect(onMedia?.hooks?.afterOperation?.length ?? 0).toBeGreaterThan(
      offMedia?.hooks?.afterOperation?.length ?? 0
    )
  })

  test('does not register dedupe hooks in fields-only mode even when dedupeUploads is true', () => {
    const fieldsOnly = applyPluginOptions([{ slug: 'media', upload: true, fields: [] }], {
      mode: 'fields-only',
      dedupeUploads: true,
    })
    const fullWithDedupe = applyPluginOptions([{ slug: 'media', upload: true, fields: [] }], {
      dedupeUploads: true,
    })

    const fieldsOnlyMedia = fieldsOnly.collections?.find((c) => c.slug === 'media')
    const fullMedia = fullWithDedupe.collections?.find((c) => c.slug === 'media')

    expect(fieldsOnlyMedia?.hooks?.beforeChange?.length ?? 0).toBeLessThan(
      fullMedia?.hooks?.beforeChange?.length ?? 0
    )
    expect(fieldsOnlyMedia?.hooks?.afterOperation?.length ?? 0).toBeLessThan(
      fullMedia?.hooks?.afterOperation?.length ?? 0
    )
  })

  test('registers delete afterOperation normalizer when reference guard is enabled', () => {
    const config = applyPlugin([{ slug: 'media', upload: true, fields: [] }])
    const media = config.collections?.find((c) => c.slug === 'media')
    const afterOperationHooks = media?.hooks?.afterOperation ?? []

    expect(afterOperationHooks.length).toBeGreaterThanOrEqual(1)
  })

  test('reference-integrity hook is first in the beforeDelete chain on media collections', async () => {
    const config = applyPlugin([{ slug: 'media', upload: true, fields: [] }])

    const media = config.collections?.find((c) => c.slug === 'media')
    const beforeDeleteHooks = media?.hooks?.beforeDelete ?? []

    // Both the integrity guard and the Sanity asset cleanup hook must be registered.
    expect(beforeDeleteHooks.length).toBeGreaterThanOrEqual(2)

    // The first hook must be the integrity guard: when references exist it throws
    // an APIError before the Sanity cleanup hook runs.
    const req = {
      t: enTestT,
      payload: {
        config: {
          collections: [
            { slug: 'media', fields: [], flattenedFields: [], upload: true },
            {
              slug: 'pages',
              fields: [{ name: 'cover', type: 'upload', relationTo: 'media' }],
              flattenedFields: [],
            },
          ],
          routes: { admin: '/admin', api: '/api' },
          serverURL: 'http://localhost:3000',
        },
        find: async () => ({ docs: [{ id: 1 }], totalDocs: 1 }),
      },
    }

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beforeDeleteHooks[0]!({ id: 1, req } as any)
    ).rejects.toThrow('Cannot delete')
  })

  test('skips reference-integrity hook when preventDeleteWhenReferenced is false', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
      preventDeleteWhenReferenced: false,
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const beforeDeleteHooks = media?.hooks?.beforeDelete ?? []

    expect(beforeDeleteHooks.length).toBe(1)
  })

  test('skips reference-integrity hook when collection-level preventDeleteWhenReferenced is false', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: { preventDeleteWhenReferenced: false } },
      preventDeleteWhenReferenced: true,
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const beforeDeleteHooks = media?.hooks?.beforeDelete ?? []

    expect(beforeDeleteHooks.length).toBe(1)
  })

  test('registers upload busy shield on beforeDocumentControls by default', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    expect(media?.admin?.components?.edit?.beforeDocumentControls).toContain(
      '@klnap/payload-storage-sanity/admin#MediaUploadBusyShield'
    )
  })

  test('skips upload busy shield when admin.uploadBusyShield is false', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      admin: { uploadBusyShield: false },
      collections: { media: true },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const controls = media?.admin?.components?.edit?.beforeDocumentControls ?? []
    expect(controls).not.toContain('@klnap/payload-storage-sanity/admin#MediaUploadBusyShield')
  })

  test('injects Asset | References tabs, hidden sync/sanity, and custom Upload', () => {
    const config = applyPlugin([{ slug: 'media', upload: true, fields: [] }])
    const media = config.collections?.find((c) => c.slug === 'media')
    const tabs = media?.fields?.find((f) => f.type === 'tabs')
    expect(tabs).toBeDefined()
    expect(tabs && 'tabs' in tabs && tabs.tabs?.map((t) => t.label)).toEqual([
      'Asset',
      'References',
    ])
    const sanityGroup = media?.fields?.find(
      (f) => 'name' in f && f.name === 'sanity' && f.type === 'group'
    )
    expect(sanityGroup).toBeDefined()
    expect(
      sanityGroup &&
        'admin' in sanityGroup &&
        sanityGroup.admin &&
        'hidden' in sanityGroup.admin &&
        sanityGroup.admin.hidden
    ).toBe(true)
    expect(sanityGroup && 'hidden' in sanityGroup && sanityGroup.hidden === true).toBe(false)
    const sanityFields =
      sanityGroup && 'fields' in sanityGroup && Array.isArray(sanityGroup.fields)
        ? sanityGroup.fields
        : []
    expect(sanityFields.some((f) => 'name' in f && f.name === 'asset' && f.type === 'json')).toBe(
      true
    )
    const tabFields = tabs && 'tabs' in tabs ? tabs.tabs?.flatMap((t) => t.fields ?? []) : []
    expect(tabFields?.some((f) => 'name' in f && f.name === 'mediaReferences')).toBe(true)
    expect(media?.fields?.some((f) => 'name' in f && f.name === 'mediaUsageInspector')).toBe(false)
    const sync = media?.fields?.find((f) => 'name' in f && f.name === 'sync')
    expect(sync).toBeDefined()
    expect(sync && 'hidden' in sync && sync.hidden === true).toBe(true)
    expect(media?.admin?.components?.edit?.Upload).toBe(
      '@klnap/payload-storage-sanity/admin#MediaAssetUpload'
    )
    expect(media?.fields?.some((f) => 'name' in f && f.name === '_objectKey')).toBe(false)
    expect(media?.fields?.some((f) => 'name' in f && f.name === 'sanityAssetMeta')).toBe(false)
    const rootSanityCount =
      media?.fields?.filter((f) => 'name' in f && f.name === 'sanity').length ?? 0
    expect(rootSanityCount).toBe(1)
  })
})
