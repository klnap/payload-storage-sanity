import { describe, expect, test } from 'bun:test'

import { formatMediaUsageBlockMessage } from '../../../src/utils/usageSummary.js'

describe('formatMediaUsageBlockMessage', () => {
  test('formats singular message', () => {
    const msg = formatMediaUsageBlockMessage([
      {
        id: 1,
        title: 'Post A',
        collectionSlug: 'posts',
        collectionLabel: 'Post',
        fieldPath: 'cover',
        fieldLabel: 'Cover',
        adminPath: '/admin',
      },
    ])

    expect(msg).toContain('Cannot delete media asset')
    expect(msg).toContain('1 document')
    expect(msg).toContain('Post')
  })

  test('formats plural message summarizing collections', () => {
    const msg = formatMediaUsageBlockMessage([
      {
        id: 1,
        title: 'Post A',
        collectionSlug: 'posts',
        collectionLabel: 'Post',
        fieldPath: 'cover',
        fieldLabel: 'Cover',
        adminPath: '/admin',
      },
      {
        id: 2,
        title: 'Post B',
        collectionSlug: 'posts',
        collectionLabel: 'Post',
        fieldPath: 'cover',
        fieldLabel: 'Cover',
        adminPath: '/admin',
      },
      {
        id: 3,
        title: 'Page A',
        collectionSlug: 'pages',
        collectionLabel: 'Page',
        fieldPath: 'hero',
        fieldLabel: 'Hero',
        adminPath: '/admin',
      },
    ])

    expect(msg).toContain('3 documents')
    expect(msg).toContain('Post')
    expect(msg).toContain('Page')
  })
})
