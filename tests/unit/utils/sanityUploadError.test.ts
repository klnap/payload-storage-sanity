import { describe, expect, test } from 'bun:test'
import { APIError } from 'payload'

import { throwSanityUploadAPIError } from '../../../src/utils/sanityUploadError.js'

describe('throwSanityUploadAPIError', () => {
  test('maps 401 Session not found to actionable APIError', () => {
    const sanityError = {
      statusCode: 401,
      response: {
        statusCode: 401,
        body: {
          message: 'Session not found',
          errorCode: 'SIO-401-ANF',
        },
      },
    }

    try {
      throwSanityUploadAPIError(sanityError)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      const apiError = error as APIError
      expect(apiError.status).toBe(502)
      expect(apiError.isPublic).toBe(false)
      expect(apiError.message).toBe('Sanity asset upload failed.')
    }
  })
})
