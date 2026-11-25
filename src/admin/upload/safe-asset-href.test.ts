import { describe, expect, test } from 'bun:test'
import { safeAssetHref } from './safe-asset-href'

describe('safeAssetHref', () => {
  test('keeps http and https targets', () => {
    expect(safeAssetHref('https://cdn.sanity.io/images/p/d/a.jpg')).toBe(
      'https://cdn.sanity.io/images/p/d/a.jpg'
    )
    expect(safeAssetHref('http://example.test/a.jpg')).toBe('http://example.test/a.jpg')
  })

  test('drops script and data targets and unparsable values', () => {
    expect(safeAssetHref('javascript:alert(1)')).toBeUndefined()
    expect(safeAssetHref('data:text/html,<script>1</script>')).toBeUndefined()
    expect(safeAssetHref('not a url')).toBeUndefined()
  })
})
