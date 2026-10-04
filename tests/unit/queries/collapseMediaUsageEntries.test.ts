import { describe, expect, test } from 'bun:test'

import { collapseMediaUsageEntries } from '../../../src/queries/collapseMediaUsageEntries.js'
import type { MediaUsageEntry } from '../../../src/queries/findMediaUsage.js'

const base = (overrides: Partial<MediaUsageEntry>): MediaUsageEntry => ({
  type: 'global',
  id: 'test',
  title: 'Test',
  name: 'Test',
  collectionSlug: 'test',
  collectionLabel: 'Test',
  fieldPath: 'image',
  fieldLabel: 'Image',
  referenceLayer: 'draft',
  adminPath: '/admin/globals/test',
  ...overrides,
})

describe('collapseMediaUsageEntries', () => {
  test('merges published + draft on same field into one published row', () => {
    const collapsed = collapseMediaUsageEntries([
      base({ referenceLayer: 'draft', adminPath: '/admin/globals/test' }),
      base({
        referenceLayer: 'published',
        adminPath: '/admin/globals/test',
        versionId: 2,
      }),
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0].referenceLayer).toBe('published')
    expect(collapsed[0].versionId).toBe(2)
  })

  test('keeps draft-only reference', () => {
    const collapsed = collapseMediaUsageEntries([base({ referenceLayer: 'draft' })])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0].referenceLayer).toBe('draft')
  })
})
