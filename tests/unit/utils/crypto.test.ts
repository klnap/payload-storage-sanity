import { describe, expect, test } from 'bun:test'

import { hashFileContent } from '../../../src/utils/crypto.js'

describe('hashFileContent', () => {
  test('returns stable sha1 hex', () => {
    const buffer = Buffer.from('same-bytes')
    const hash = hashFileContent(buffer)

    expect(hash).toHaveLength(40)
    expect(hashFileContent(buffer)).toBe(hash)
    expect(hashFileContent(Buffer.from('other'))).not.toBe(hash)
  })
})
