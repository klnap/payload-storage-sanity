import { describe, expect, test } from 'bun:test'
import { APIError } from 'payload'

import {
  assertSanityReadyForUpload,
  getSanityStorageConfigIssues,
} from '../../../src/utils/sanityConfig.js'

describe('sanityConfig', () => {
  test('detects placeholder credentials', () => {
    const issues = getSanityStorageConfigIssues({
      projectId: 'your-sanity-project-id',
      dataset: 'production',
      token: 'your-sanity-api-write-token',
    })

    expect(issues.length).toBe(2)
  })

  test('assertSanityReadyForUpload throws APIError before calling Sanity', () => {
    try {
      assertSanityReadyForUpload({
        projectId: 'your-sanity-project-id',
        dataset: 'production',
        token: 'secret',
      })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      expect((error as APIError).status).toBe(502)
      expect((error as APIError).isPublic).toBe(false)
    }
  })
})
