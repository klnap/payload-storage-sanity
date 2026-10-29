/** Classification: test-only — logging must not echo webhook secrets or raw bodies by default. */
import { afterEach, describe, expect, mock, test } from 'bun:test'

import {
  logSanityUploadIssue,
  SANITY_UPLOAD_LOG_PREFIX,
} from '@/features/media/storage-adapter/rollback'

describe('logSanityUploadIssue', () => {
  const errorSpy = mock((..._args: unknown[]) => {})

  afterEach(() => {
    errorSpy.mockReset()
  })

  test('logs summary with package prefix only when context omitted', () => {
    const original = console.error
    console.error = errorSpy as typeof console.error

    try {
      logSanityUploadIssue('upload failed')
      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy.mock.calls[0]?.[0]).toBe(`${SANITY_UPLOAD_LOG_PREFIX} upload failed`)
    } finally {
      console.error = original
    }
  })

  test('does not mutate or stringify sensitive fields beyond caller context', () => {
    const original = console.error
    console.error = errorSpy as typeof console.error
    const context = { mediaId: 1, phase: 'rollback' }

    try {
      logSanityUploadIssue('rollback failed', context)
      expect(errorSpy).toHaveBeenCalledTimes(2)
      expect(errorSpy.mock.calls[1]?.[0]).toBe(context)
      expect(JSON.stringify(errorSpy.mock.calls[1]?.[0])).not.toContain('whsec')
    } finally {
      console.error = original
    }
  })
})
