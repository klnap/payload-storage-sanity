import { expect, test } from 'bun:test'
import { isGalleryQueryReady } from './gallery-list'

test('does not show gallery results from a stale collection query', () => {
  expect(isGalleryQueryReady('projects', 'media')).toBe(false)
})

test('shows gallery results once the media query is ready', () => {
  expect(isGalleryQueryReady('media', 'media')).toBe(true)
})
