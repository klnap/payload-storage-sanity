import { expect, test } from 'bun:test'
import { presentMedia } from './media'

test('uses the hydrated thumbnail over the original and needs no image sizes', () => {
  const media = presentMedia({
    id: 1,
    mimeType: 'image/jpeg',
    thumbnailURL: 'https://cdn.sanity.io/images/demo/asset.jpg?w=300&fit=max',
    url: 'https://cdn.sanity.io/images/demo/asset.jpg',
    width: 800,
    height: 1200,
  })
  expect(media.thumbnail).toContain('w=300')
  expect(media.ratio).toBe(2 / 3)
})

test('uses a localized label or a readable fallback rather than a UUID', () => {
  const doc = {
    id: '7c26584d-1f08-4b81-92fb-40bfe392fead',
    filename: '7c26584d-1f08-4b81-92fb-40bfe392fead.jpg',
    alt: { pl: 'Okno', en: 'Window' },
    height: 0,
  }
  expect(presentMedia(doc, 'pl').label).toBe('Okno')
  expect(presentMedia(doc, 'de')).toEqual({
    kind: 'image',
    family: 'image',
    extension: 'jpg',
    label: 'Untitled image',
    ratio: 4 / 3,
    thumbnail: undefined,
  })
})

test('does not load audio, video, or document URLs as images', () => {
  for (const [mimeType, kind] of [
    ['audio/ogg', 'audio'],
    ['video/mp4', 'video'],
    ['application/pdf', 'file'],
  ]) {
    expect(presentMedia({ mimeType, thumbnailURL: '/file' })).toMatchObject({
      kind,
      thumbnail: undefined,
    })
  }
})

test('labels files by family and identifies them by filename with a readable size', () => {
  expect(
    presentMedia({
      name: 'Annual report',
      filename: 'annual-report.PDF',
      mimeType: 'application/pdf',
      filesize: 2300,
    })
  ).toMatchObject({ family: 'pdf', format: 'PDF', label: 'annual-report.PDF', size: '2.2 KB' })
  expect(presentMedia({ mimeType: 'text/plain' })).toMatchObject({ family: 'text', format: 'Text' })
  expect(
    presentMedia({ filename: 'a.pdf', mimeType: 'application/pdf', filesize: 3 * 1024 ** 2 }).size
  ).toBe('3.0 MB')
})

test('classifies by MIME first and by extension only when MIME is generic or unknown', () => {
  expect(
    presentMedia({ filename: 'Budget.XLSX', mimeType: 'application/octet-stream' }).family
  ).toBe('sheet')
  expect(presentMedia({ filename: 'site.tar.gz', mimeType: 'application/gzip' }).family).toBe(
    'archive'
  )
  expect(presentMedia({ filename: 'report.docx', mimeType: 'application/pdf' }).family).toBe('pdf')
  expect(presentMedia({ filename: 'mystery.bin' }).family).toBe('file')
  expect(presentMedia({ filename: 'deck.pptx', mimeType: 'application/zip' }).family).toBe('slides')
})

test('uses direct or Sanity-persisted LQIP for raster images but not SVGs', () => {
  const directLqip = 'data:image/webp;base64,Zm9v'
  const sanityLqip = 'data:image/jpeg;base64,YmFy'

  expect(
    presentMedia({
      filename: 'photo.webp',
      mimeType: 'image/webp',
      lqip: directLqip,
      url: 'https://cdn.example.test/photo.webp',
    }).lqip
  ).toBe(directLqip)

  expect(
    presentMedia({
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sanity: { asset: { metadata: { lqip: sanityLqip } } },
      url: 'https://cdn.sanity.io/images/demo/photo.jpg',
    }).lqip
  ).toBe(sanityLqip)

  expect(
    presentMedia({
      filename: 'logo.svg',
      mimeType: 'image/svg+xml',
      lqip: sanityLqip,
      url: 'https://cdn.example.test/logo.svg',
    }).lqip
  ).toBeUndefined()
})

test('falls back to a safe original when thumbnail metadata is absent or unsafe', () => {
  const doc = { filename: 'image.jpg', mimeType: 'bad metadata', url: '/api/media/file/image.jpg' }
  for (const thumbnailURL of [
    'javascript:alert(1)',
    '//external.test/x',
    '/\\evil.test/x',
    'https://user@external.test/x',
    'https://[invalid-host',
  ]) {
    expect(presentMedia({ ...doc, thumbnailURL }).thumbnail).toBe(doc.url)
  }
  expect(presentMedia({ ...doc, url: null }).thumbnail).toBeUndefined()
})

test('labels by the original filename, never a UUID or the generic placeholder', () => {
  expect(
    presentMedia({
      filename: '7c26584d-1f08-4b81-92fb-40bfe392fead',
      sanity: { asset: { originalFilename: 'Q3 Plan.pdf' } },
      mimeType: 'application/pdf',
    }).label
  ).toBe('Q3 Plan.pdf')
  expect(
    presentMedia({
      mimeType: 'application/pdf',
      url: 'https://cdn.example.test/files/a%20b.pdf?x=1',
    }).label
  ).toBe('a b.pdf')
})

test('prefers the asset title over the original filename for the label', () => {
  expect(
    presentMedia({ title: 'Hero shot', filename: 'IMG_0042.jpg', mimeType: 'image/jpeg' }).label
  ).toBe('Hero shot')
  expect(
    presentMedia({ title: '  ', filename: 'IMG_0042.jpg', mimeType: 'image/jpeg' }).label
  ).toBe('IMG_0042.jpg')
})

test('exposes extension and Sanity original filename for non-image files', () => {
  const media = presentMedia({
    filename: 'b0220c31.txt',
    mimeType: 'text/plain',
    sanity: { asset: { originalFilename: 'Notes.txt' } },
  })
  expect(media).toMatchObject({ family: 'text', extension: 'txt', originalName: 'Notes.txt' })
})
