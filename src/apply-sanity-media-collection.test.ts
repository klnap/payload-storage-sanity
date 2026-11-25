import { describe, expect, test } from 'bun:test'
import type { CollectionConfig } from 'payload'
import { resolveSanityStorageMode } from '@/core/config'
import { createSanityClient } from '@/sanity/client'
import { applySanityStorageToMediaCollection } from './apply-sanity-media-collection.ts'

describe('applySanityStorageToMediaCollection', () => {
  const client = createSanityClient({
    projectId: 'demo',
    dataset: 'production',
    token: 'token',
  })

  const baseCtx = {
    options: {
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true as const },
    },
    collections: { media: true as const },
    configuredMediaSlugs: new Set(['media']),
    localizationLocales: [],
    pluginAdmin: undefined,
    pluginUploadMaxSize: undefined,
    dedupeUploads: false,
    preventDeleteWhenReferenced: true,
    cloudStorageEnabled: true,
    storageMode: resolveSanityStorageMode({ mode: 'full' }),
    client,
    cdnBaseUrl: undefined,
  }

  test('returns collection unchanged when slug is not configured', () => {
    const collection: CollectionConfig = { slug: 'pages', fields: [] }
    const result = applySanityStorageToMediaCollection(collection, baseCtx)
    expect(result).toBe(collection)
  })

  test('guards local deletion without registering remote asset cleanup', () => {
    const collection: CollectionConfig = { slug: 'media', upload: true, fields: [] }
    const result = applySanityStorageToMediaCollection(collection, baseCtx)
    expect(result.hooks?.afterDelete).toBeUndefined()
    expect(result.hooks?.beforeDelete ?? []).toHaveLength(1)
  })

  test.each(['full', 'fields-only', 'off'] as const)(
    'does not register remote cleanup in %s mode',
    (mode) => {
      const storageMode = resolveSanityStorageMode({ mode })
      const result = applySanityStorageToMediaCollection(
        { slug: 'media', upload: true, fields: [] },
        {
          ...baseCtx,
          cloudStorageEnabled: storageMode.cloudStorageEnabled,
          storageMode,
        }
      )

      expect(result.hooks?.afterDelete).toBeUndefined()
      expect(result.hooks?.beforeDelete ?? []).toHaveLength(1)
    }
  )

  test('preserves host beforeChange hooks in the composed chain', () => {
    const hostHook = () => undefined
    const collection: CollectionConfig = {
      slug: 'media',
      upload: true,
      fields: [],
      hooks: { beforeChange: [hostHook] },
    }
    const result = applySanityStorageToMediaCollection(collection, baseCtx)
    const beforeChange = result.hooks?.beforeChange ?? []
    expect(beforeChange).toContain(hostHook)
    expect(beforeChange.length).toBeGreaterThan(1)
  })
})
