import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'

import {
  formatDuplicateUploadCompactMessage,
  MEDIA_DUPLICATE_UPLOAD_ERROR_CODE,
  throwDuplicateUploadAPIError,
} from '@/features/media/lifecycle/dedupe'
import { enTestT } from '../../../helpers/enTestT'

describe('duplicate upload errors', () => {
  test('compact message includes filename and existing id', () => {
    expect(formatDuplicateUploadCompactMessage(enTestT, 'hero.jpg', 'media-1')).toBe(
      'hero.jpg: already in library (ID media-1)'
    )
  })

  test('throwDuplicateUploadAPIError is public 409 with file field error', () => {
    const req = {
      t: enTestT,
      file: { name: 'hero.jpg', data: Buffer.from('x') },
    } as unknown as PayloadRequest

    try {
      throwDuplicateUploadAPIError(req, 'media-42')
      throw new Error('expected APIError')
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      const apiError = error as APIError
      expect(apiError.status).toBe(409)
      expect(apiError.message).toBe('hero.jpg: already in library (ID media-42)')
      expect(apiError.data).toMatchObject({
        code: MEDIA_DUPLICATE_UPLOAD_ERROR_CODE,
        existingId: 'media-42',
        errors: [
          {
            path: 'file',
            message:
              'This file is already in your media library (ID media-42). Open the existing asset instead of uploading again.',
          },
        ],
      })
    }
  })
})
