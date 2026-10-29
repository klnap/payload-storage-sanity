import { describe, expect, test } from 'bun:test'
import type { CollectionConfig } from 'payload'
import { resolveSanityStorageMode } from '@/core/config'
import { createSanityClient } from '@/sanity/client'
import { applySanityStorageToMediaCollection } from '../../../src/apply-sanity-media-collection'

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

  test('registers reference-integrity beforeDelete before Sanity asset cleanup', () => {
    const collection: CollectionConfig = { slug: 'media', upload: true, fields: [] }
    const result = applySanityStorageToMediaCollection(collection, baseCtx)
    const hooks = result.hooks?.beforeDelete ?? []
    expect(hooks.length).toBeGreaterThanOrEqual(2)
  })

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
