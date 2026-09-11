import { describe, expect, test } from 'bun:test'
import type { SanitizedConfig } from 'payload'

import { collectMediaUploadTargets } from '../../../src/queries/collectMediaUploadTargets.js'

describe('collectMediaUploadTargets', () => {
  test('finds top-level and grouped upload fields across collections and globals', () => {
    const config = {
      collections: [
        {
          slug: 'posts',
          labels: { singular: 'Post' },
          fields: [
            { name: 'cover', type: 'upload', relationTo: 'media', label: 'Cover Image' },
            {
              name: 'meta',
              type: 'group',
              fields: [{ name: 'ogImage', type: 'upload', relationTo: 'media' }],
            },
          ],
        },
        {
          slug: 'authors',
          fields: [{ name: 'avatar', type: 'upload', relationTo: 'media' }],
        },
      ],
      globals: [
        {
          slug: 'header',
          label: 'Site Header',
          fields: [{ name: 'logo', type: 'upload', relationTo: 'media', label: 'Logo' }],
        },
      ],
    } as unknown as SanitizedConfig

    const targets = collectMediaUploadTargets(config, 'media')

    expect(targets).toHaveLength(4)
    expect(targets).toContainEqual({
      type: 'collection',
      collectionSlug: 'posts',
      label: 'Post',
      fieldPath: 'cover',
      fieldLabel: 'Cover Image',
      hasMany: false,
    })
    expect(targets).toContainEqual({
      type: 'collection',
      collectionSlug: 'posts',
      label: 'Post',
      fieldPath: 'meta.ogImage',
      fieldLabel: 'ogImage',
      hasMany: false,
    })
    expect(targets).toContainEqual({
      type: 'collection',
      collectionSlug: 'authors',
      label: 'authors',
      fieldPath: 'avatar',
      fieldLabel: 'avatar',
      hasMany: false,
    })
    expect(targets).toContainEqual({
      type: 'global',
      collectionSlug: 'header',
      label: 'Site Header',
      fieldPath: 'logo',
      fieldLabel: 'Logo',
      hasMany: false,
    })
  })

  test('skips media collection and unrelated uploads', () => {
    const config = {
      collections: [
        {
          slug: 'media',
          fields: [{ name: 'preview', type: 'upload', relationTo: 'media' }],
        },
        {
          slug: 'docs',
          fields: [{ name: 'file', type: 'upload', relationTo: 'documents' }],
        },
      ],
      globals: [],
    } as unknown as SanitizedConfig

    const targets = collectMediaUploadTargets(config, 'media')
    expect(targets).toHaveLength(0)
  })
})
