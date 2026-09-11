import { describe, expect, test } from 'bun:test'

import {
  collectWebhookAssetIds,
  isImageAssetId,
  parseSanityWebhookPayload,
} from '../../../src/webhook/parsePayload.js'

describe('parseSanityWebhookPayload', () => {
  test('parses valid JSON', () => {
    const payload = parseSanityWebhookPayload(
      JSON.stringify({ ids: { deleted: ['image-a-jpg'], updated: ['file-b'] } })
    )

    expect(payload?.ids?.deleted).toEqual(['image-a-jpg'])
  })

  test('returns null for invalid JSON and empty bodies', () => {
    expect(parseSanityWebhookPayload('not-json')).toBeNull()
    expect(parseSanityWebhookPayload('')).toBeNull()
  })
})

describe('collectWebhookAssetIds', () => {
  test('normalizes missing arrays', () => {
    expect(collectWebhookAssetIds({})).toEqual({
      created: [],
      deleted: [],
      updated: [],
    })
  })
})

describe('isImageAssetId', () => {
  test('detects Sanity image asset ids', () => {
    expect(isImageAssetId('image-abc-800x600-jpg')).toBe(true)
    expect(isImageAssetId('file-abc')).toBe(false)
  })
})
