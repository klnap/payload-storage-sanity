import { APIError } from 'payload'
import type { SanityStorageTranslateFn } from '@/core/i18n'
import { SANITY_STORAGE_I18N_KEYS, sanityStorageTranslate } from '@/core/i18n'

const PLACEHOLDER_PATTERNS = [/^your[-_]/i, /^change[-_]/i, /^<.*>$/, /placeholder/i]

export type SanityStorageCredentials = {
  projectId?: string
  dataset?: string
  token?: string
}

function looksLikePlaceholder(value: string | undefined): boolean {
  if (!value?.trim()) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()))
}

export function getSanityStorageConfigIssues(credentials: SanityStorageCredentials): string[] {
  const issues: string[] = []

  if (looksLikePlaceholder(credentials.projectId)) {
    issues.push('`projectId` is missing or looks like a placeholder')
  }

  if (looksLikePlaceholder(credentials.dataset)) {
    issues.push('`dataset` is missing or looks like a placeholder')
  }

  if (looksLikePlaceholder(credentials.token)) {
    issues.push('`token` is missing or looks like a placeholder (required for uploads)')
  }

  return issues
}

export function warnSanityStorageConfig(credentials: SanityStorageCredentials): void {
  const issues = getSanityStorageConfigIssues(credentials)
  if (issues.length === 0) return

  console.warn(
    [
      '[@klnap/payload-storage-sanity] Sanity storage is misconfigured:',
      ...issues.map((issue) => `  - ${issue}`),
      'Media uploads will fail until `sanityStorage({ projectId, dataset, token })` is set correctly.',
    ].join('\n')
  )
}

export function assertSanityReadyForUpload(
  credentials: SanityStorageCredentials,
  t?: SanityStorageTranslateFn
): void {
  const issues = getSanityStorageConfigIssues(credentials)
  if (issues.length === 0) return

  const message = t
    ? sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.sanityNotConfiguredForUpload)
    : 'Sanity storage is not configured for uploads.'

  console.error('[@klnap/payload-storage-sanity]', message, {
    issues,
    hint: 'Set valid projectId, dataset, and token on sanityStorage().',
  })

  throw new APIError(message, 502, { issues }, false)
}
