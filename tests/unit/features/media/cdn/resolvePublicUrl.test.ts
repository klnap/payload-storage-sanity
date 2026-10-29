import { describe, expect, test } from 'bun:test'

import { resolvePublicUrl } from '@/features/media/cdn'

const datasetDoc = {
  id: 1,
  sync: { status: 'available' as const },
  sanity: {
    asset: {
      _id: 'image-abc123-800x600-jpg',
      _type: 'sanity.imageAsset',
      path: 'images/demo/production/abc123-800x600.jpg',
      url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
    },
  },
}

describe('resolvePublicUrl', () => {
  test('joins cdnBaseUrl with sanity.asset.path for dataset assets', () => {
    const url = resolvePublicUrl(datasetDoc, {
      cdnBaseUrl: 'https://cdn.example.com',
    })
    expect(url).toBe('https://cdn.example.com/images/demo/production/abc123-800x600.jpg')
  })

  test('applies transform params only for compatible image hosts', () => {
    const url = resolvePublicUrl(datasetDoc, {
      transform: { width: 300, fit: 'max', autoFormat: true },
    })
    expect(url).toContain('w=300')
    expect(url).toContain('auto=format')
  })

  test('does not apply transform params for file assets', () => {
    const pdf = {
      ...datasetDoc,
      sanity: {
        asset: {
          _id: 'file-pdf123-pdf',
          _type: 'sanity.fileAsset',
          path: 'files/demo/production/doc.pdf',
          url: 'https://cdn.sanity.io/files/demo/production/doc.pdf',
          mimeType: 'application/pdf',
        },
      },
    }
    const url = resolvePublicUrl(pdf, {
      transform: { width: 300 },
    })
    expect(url).toBe('https://cdn.sanity.io/files/demo/production/doc.pdf')
    expect(url).not.toContain('w=')
  })

  test('returns stored sanity.asset.url when path is absent', () => {
    const doc = {
      id: 2,
      sync: { status: 'available' as const },
      sanity: {
        asset: {
          _id: 'ml-asset',
          url: 'https://cdn.sanity.io/media-libraries/lib123/photo.jpg',
        },
      },
    }
    const url = resolvePublicUrl(doc, {
      cdnBaseUrl: 'https://cdn.example.com',
      transform: { width: 400 },
    })
    expect(url).toBe('https://cdn.example.com/media-libraries/lib123/photo.jpg')
    expect(url).not.toContain('w=')
  })

  test('returns null when sync is unavailable', () => {
    expect(
      resolvePublicUrl({
        ...datasetDoc,
        sync: { status: 'deleted' },
      })
    ).toBeNull()
  })

  test('returns null when only sanity.asset._id exists without path or url', () => {
    expect(
      resolvePublicUrl({
        id: 3,
        sync: { status: 'available' },
        sanity: { asset: { _id: 'image-abc123-800x600-jpg' } },
      })
    ).toBeNull()
  })

  test('returns null when stored asset url is not on an allowlisted host', () => {
    const url = resolvePublicUrl({
      id: 4,
      sync: { status: 'available' as const },
      sanity: {
        asset: {
          _id: 'image-evil-jpg',
          url: 'https://evil.example.com/malware.jpg',
        },
      },
    })
    expect(url).toBeNull()
  })
})
