import { describe, expect, test } from 'bun:test'

import type { MediaUsageEntry } from '../../../src/queries/findMediaUsage.js'
import {
  formatMediaUsageBlockMessage,
  formatMediaUsageCompactDeleteMessage,
  resolveMediaDeleteLabel,
  summarizeMediaUsage,
} from '../../../src/utils/usageSummary.js'

describe('summarizeMediaUsage', () => {
  test('aggregates distinct documents by collection and global', () => {
    const entries: MediaUsageEntry[] = [
      {
        type: 'collection',
        id: 1,
        title: 'Post 1',
        name: 'Post',
        collectionSlug: 'posts',
        collectionLabel: 'Post',
        fieldPath: 'featuredImage',
        fieldLabel: 'Featured Image',
        referenceLayer: 'draft',
        adminPath: '/admin/collections/posts/1',
      },
      {
        type: 'collection',
        id: 1,
        title: 'Post 1',
        name: 'Post',
        collectionSlug: 'posts',
        collectionLabel: 'Post',
        fieldPath: 'gallery',
        fieldLabel: 'Gallery',
        referenceLayer: 'draft',
        adminPath: '/admin/collections/posts/1',
      },
      {
        type: 'global',
        id: 'global',
        title: 'Site Header',
        name: 'Site Header',
        collectionSlug: 'header',
        collectionLabel: 'Site Header',
        fieldPath: 'logo',
        fieldLabel: 'Logo',
        referenceLayer: 'published',
        adminPath: '/admin/globals/header',
      },
    ]

    const summary = summarizeMediaUsage(entries)
    expect(summary.totalDistinctDocuments).toBe(2)
    expect(summary.collections).toHaveLength(2)
  })
})

describe('resolveMediaDeleteLabel', () => {
  test('prefers filename then name then id', () => {
    expect(resolveMediaDeleteLabel({ filename: 'a.jpg', name: 'A' }, 1)).toBe('a.jpg')
    expect(resolveMediaDeleteLabel({ name: 'Hero' }, 1)).toBe('Hero')
    expect(resolveMediaDeleteLabel(null, 'short')).toBe('short')
  })
})

describe('formatMediaUsageCompactDeleteMessage', () => {
  test('formats compact bulk line', () => {
    const entries: MediaUsageEntry[] = [
      {
        type: 'collection',
        id: 1,
        title: 'Post',
        name: 'Post',
        collectionSlug: 'posts',
        collectionLabel: 'Post',
        fieldPath: 'image',
        fieldLabel: 'Image',
        referenceLayer: 'published',
        adminPath: '/admin/collections/posts/1',
      },
    ]
    expect(formatMediaUsageCompactDeleteMessage('hero.jpg', entries)).toBe(
      'hero.jpg: in use (1 document)'
    )
  })
})

describe('formatMediaUsageBlockMessage', () => {
  test('formats singular message', () => {
    const entries: MediaUsageEntry[] = [
      {
        type: 'collection',
        id: 1,
        title: 'Post 1',
        name: 'Post',
        collectionSlug: 'posts',
        collectionLabel: 'Post',
        fieldPath: 'featuredImage',
        fieldLabel: 'Featured Image',
        referenceLayer: 'draft',
        adminPath: '/admin/collections/posts/1',
      },
    ]

    const msg = formatMediaUsageBlockMessage(entries)
    expect(msg).toBe(
      'Cannot delete media asset because it is currently referenced by 1 document.'
    )
  })

  test('formats plural message summarizing collections and globals', () => {
    const entries: MediaUsageEntry[] = [
      {
        type: 'collection',
        id: 1,
        title: 'Post 1',
        name: 'Post',
        collectionSlug: 'posts',
        collectionLabel: 'Post',
        fieldPath: 'featuredImage',
        fieldLabel: 'Featured Image',
        referenceLayer: 'published',
        adminPath: '/admin/collections/posts/1',
      },
      {
        type: 'global',
        id: 'global',
        title: 'Site Header',
        name: 'Site Header',
        collectionSlug: 'header',
        collectionLabel: 'Site Header',
        fieldPath: 'logo',
        fieldLabel: 'Logo',
        referenceLayer: 'published',
        adminPath: '/admin/globals/header',
      },
    ]

    const msg = formatMediaUsageBlockMessage(entries)
    expect(msg).toBe(
      'Cannot delete media asset because it is currently referenced by 2 documents.'
    )
  })
})
