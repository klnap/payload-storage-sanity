import { APIError } from 'payload'

import { logSanityUploadIssue } from './sanityUploadLog'

type SanityErrorBody = {
  message?: string
  errorCode?: string
  statusCode?: number
}

type SanityLikeError = {
  message?: string
  statusCode?: number
  response?: {
    statusCode?: number
    body?: SanityErrorBody
  }
}

function asSanityLikeError(error: unknown): SanityLikeError {
  if (error != null && typeof error === 'object') {
    return error as SanityLikeError
  }
  return { message: String(error) }
}

function sanityStatus(error: SanityLikeError): number | undefined {
  return error.statusCode ?? error.response?.statusCode ?? error.response?.body?.statusCode
}

function sanityMessage(error: SanityLikeError): string {
  return error.response?.body?.message ?? error.message ?? 'Unknown Sanity API error'
}

function sanityErrorCode(error: SanityLikeError): string | undefined {
  return error.response?.body?.errorCode
}

function buildSanityUploadLogMessage(
  status: number | undefined,
  code: string | undefined,
  detail: string
): string {
  if (status === 401 || code === 'SIO-401-ANF') {
    return [
      'Sanity rejected the upload (unauthorized).',
      'Check projectId, dataset, and token on sanityStorage().',
      'The token must have write access to upload assets to the configured dataset.',
      detail !== 'Session not found' ? `Sanity: ${detail}` : undefined,
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (status === 403) {
    return `Sanity rejected the upload (forbidden). Verify API token permissions. Sanity: ${detail}`
  }

  if (status === 404) {
    return `Sanity project or dataset not found. Check projectId and dataset on sanityStorage(). Sanity: ${detail}`
  }

  return `Sanity asset upload failed (${status ?? 'unknown status'}): ${detail}`
}

/**
 * Maps @sanity/client failures during asset upload to a Payload APIError.
 * Detailed diagnostics are logged server-side; the admin UI gets Payload's generic message.
 */
export function throwSanityUploadAPIError(error: unknown): never {
  if (error instanceof APIError) {
    throw error
  }

  const err = asSanityLikeError(error)
  const status = sanityStatus(err)
  const code = sanityErrorCode(err)
  const detail = sanityMessage(err)
  const logMessage = buildSanityUploadLogMessage(status, code, detail)

  logSanityUploadIssue(logMessage, { status, code, detail, err })

  throw new APIError('Sanity asset upload failed.', 502, { status, code, detail }, false)
}
