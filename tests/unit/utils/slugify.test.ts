import { describe, expect, test } from 'bun:test'

import { slugifyFilename } from '../../../src/utils/slugify.js'

describe('slugifyFilename', () => {
  test('slugifies filenames with spaces and special characters while preserving extension', () => {
    expect(slugifyFilename('name test.avif')).toBe('name-test.avif')
    expect(slugifyFilename('My New Image (2026)!.PNG')).toBe('my-new-image-2026.png')
    expect(slugifyFilename('annual report final draft.pdf')).toBe('annual-report-final-draft.pdf')
    expect(slugifyFilename('archive.tar.gz')).toBe('archive-tar.gz')
  })

  test('handles empty or extensionless inputs', () => {
    expect(slugifyFilename('')).toBe('')
    expect(slugifyFilename(null)).toBe('')
    expect(slugifyFilename(undefined)).toBe('')
    expect(slugifyFilename('document')).toBe('document')
    expect(slugifyFilename('some document name')).toBe('some-document-name')
  })
})
