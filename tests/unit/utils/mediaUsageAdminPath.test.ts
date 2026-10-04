import { describe, expect, test } from 'bun:test'
import type { SanitizedConfig } from 'payload'

import type { MediaUploadTarget } from '../../../src/queries/collectMediaUploadTargets.js'
import { buildMediaUsageAdminPath } from '../../../src/utils/mediaUsageAdminPath.js'

const config = {
  routes: { admin: '/admin' },
} as unknown as SanitizedConfig

describe('buildMediaUsageAdminPath', () => {
  test('global links to edit view', () => {
    const target: MediaUploadTarget = {
      type: 'global',
      collectionSlug: 'test',
      label: 'Test',
      fieldPath: 'image',
      fieldLabel: 'Image',
      hasMany: false,
    }
    expect(
      buildMediaUsageAdminPath({ config, target, documentId: 'test' })
    ).toBe('/admin/globals/test')
  })

  test('collection links to document edit view', () => {
    const target: MediaUploadTarget = {
      type: 'collection',
      collectionSlug: 'posts',
      label: 'Posts',
      fieldPath: 'cover',
      fieldLabel: 'Cover',
      hasMany: false,
    }
    expect(
      buildMediaUsageAdminPath({ config, target, documentId: 7 })
    ).toBe('/admin/collections/posts/7')
  })
})
