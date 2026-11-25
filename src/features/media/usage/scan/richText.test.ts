import { describe, expect, test } from 'bun:test'
import type { SanitizedConfig } from 'payload'
import { collectRichTextHosts } from './collectMediaUploadTargets'
import { containsMediaUploadNode } from './findMediaUsage'

const lexicalWithUpload = (id: number | string, relationTo = 'media') => ({
  root: {
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', text: 'hi' }] },
      { type: 'upload', relationTo, value: { id }, version: 1, format: '', fields: null },
    ],
  },
})

describe('containsMediaUploadNode', () => {
  test('finds an upload node embedded in a rich text value', () => {
    expect(containsMediaUploadNode({ body: lexicalWithUpload(7) }, 'media', 7)).toBe(true)
  })

  test('matches a bare id as well as an object id', () => {
    const bare = { root: { children: [{ type: 'upload', relationTo: 'media', value: 7 }] } }
    expect(containsMediaUploadNode(bare, 'media', 7)).toBe(true)
  })

  test('ignores other media ids and other collections', () => {
    expect(containsMediaUploadNode({ body: lexicalWithUpload(8) }, 'media', 7)).toBe(false)
    expect(containsMediaUploadNode({ body: lexicalWithUpload(7, 'docs') }, 'media', 7)).toBe(false)
  })

  test('a polymorphic relationTo that includes media counts', () => {
    expect(
      containsMediaUploadNode({ body: lexicalWithUpload(7, ['docs', 'media']) }, 'media', 7)
    ).toBe(true)
  })

  test('a Lexical internal link to the media document counts as a reference', () => {
    const link = {
      root: {
        children: [
          {
            type: 'link',
            fields: { linkType: 'internal', doc: { relationTo: 'media', value: 7 } },
          },
        ],
      },
    }
    expect(containsMediaUploadNode(link, 'media', 7)).toBe(true)
    const otherPage = {
      root: {
        children: [
          {
            type: 'link',
            fields: { linkType: 'internal', doc: { relationTo: 'pages', value: 7 } },
          },
        ],
      },
    }
    expect(containsMediaUploadNode(otherPage, 'media', 7)).toBe(false)
  })

  test('pathologically deep structures fail closed', () => {
    let deep: unknown = { leaf: true }
    for (let i = 0; i < 100; i++) deep = { child: deep }
    expect(containsMediaUploadNode(deep, 'media', 7)).toBe(true)
  })
})

describe('collectRichTextHosts', () => {
  const config = {
    collections: [
      { slug: 'media', fields: [{ name: 'alt', type: 'text' }] },
      {
        slug: 'projects',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'body', type: 'richText' },
        ],
      },
      { slug: 'people', fields: [{ name: 'name', type: 'text' }] },
    ],
    globals: [{ slug: 'home', label: 'Home', fields: [{ name: 'intro', type: 'richText' }] }],
  } as unknown as SanitizedConfig

  test('lists collections and globals that contain rich text, not the media collection', () => {
    const hosts = collectRichTextHosts(config, 'media')
    expect(hosts.map((h) => `${h.type}:${h.collectionSlug}:${h.fieldPath}`)).toEqual([
      'collection:projects:body',
      'global:home:intro',
    ])
  })
})
