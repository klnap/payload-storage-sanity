import { describe, expect, test } from 'bun:test'
import type { SanitizedConfig } from 'payload'

import { collectMediaUploadTargets } from '../../../src/queries/collectMediaUploadTargets.js'

describe('collectMediaUploadTargets', () => {
  test('finds top-level and grouped upload fields', () => {
    const config = {
      collections: [
        {
          slug: 'posts',
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
    } as unknown as SanitizedConfig

    const targets = collectMediaUploadTargets(config, 'media')

    expect(targets).toHaveLength(3)
    expect(targets).toContainEqual({
      collectionSlug: 'posts',
      fieldPath: 'cover',
      fieldLabel: 'Cover Image',
      hasMany: false,
    })
    expect(targets).toContainEqual({
      collectionSlug: 'posts',
      fieldPath: 'meta.ogImage',
      fieldLabel: 'ogImage',
      hasMany: false,
    })
    expect(targets).toContainEqual({
      collectionSlug: 'authors',
      fieldPath: 'avatar',
      fieldLabel: 'avatar',
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
    } as unknown as SanitizedConfig

    const targets = collectMediaUploadTargets(config, 'media')
    expect(targets).toHaveLength(0)
  })
})
