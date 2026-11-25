import { describe, expect, mock, test } from 'bun:test'
import { APIError } from 'payload'

import { throwSanityUploadAPIError } from '@/features/media/storage-adapter/rollback'

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

  test('logs only status, code and message for a Sanity ClientError', () => {
    const errorSpy = mock(() => {})
    const original = console.error
    console.error = errorSpy as typeof console.error

    const clientError = {
      message: 'Request failed',
      statusCode: 500,
      response: {
        statusCode: 500,
        headers: { 'x-request-id': 'secret-request-id' },
        body: { message: 'Internal', errorCode: 'SIO-500', statusCode: 500, secret: 'token-value' },
      },
    }

    try {
      expect(() => throwSanityUploadAPIError(clientError)).toThrow()
    } finally {
      console.error = original
    }

    const logged = errorSpy.mock.calls.flat()
    const context = logged[logged.length - 1] as Record<string, unknown>
    expect(context).toEqual({ status: 500, code: 'SIO-500', detail: 'Internal' })
    const serialized = JSON.stringify(logged)
    expect(serialized).not.toContain('secret-request-id')
    expect(serialized).not.toContain('token-value')
  })
})
