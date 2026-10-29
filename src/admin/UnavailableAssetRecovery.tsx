'use client'

import { Banner, Button, useTranslation } from '@payloadcms/ui'
import type { PayloadDocumentId } from '@/core/contracts'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'
import type { SanitySyncStatus } from '@/features/asset-sync'

type UnavailableAssetRecoveryProps = {
  mediaId?: PayloadDocumentId | null
  onReplace: () => void
  onUnlink: () => void
  readOnly?: boolean
  status?: SanitySyncStatus | null
}

export function UnavailableAssetRecovery({
  mediaId,
  onReplace,
  onUnlink,
  readOnly,
  status,
}: UnavailableAssetRecoveryProps) {
  const { t } = useTranslation()
  const st = t as SanityStorageTranslateFn

  const statusMessage = (() => {
    switch (status) {
      case 'deleted':
        return sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.recoveryDeleted)
      case 'error':
        return sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.recoveryError)
      case 'missing':
        return sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.recoveryMissing)
      default:
        return sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.recoveryUnavailable)
    }
  })()

  return (
    <Banner type='error'>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'calc(var(--base) * 0.5)',
        }}
      >
        <div>
          {statusMessage}
          {mediaId != null && (
            <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>
              {sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.recoveryMediaId, {
                id: String(mediaId),
              })}
            </span>
          )}
        </div>
        {!readOnly && (
          <div
            style={{
              display: 'flex',
              gap: 'calc(var(--base) * 0.5)',
              marginTop: '0.25rem',
            }}
          >
            <Button buttonStyle='primary' onClick={onReplace} size='small' type='button'>
              {sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.recoveryReplace)}
            </Button>
            <Button buttonStyle='secondary' onClick={onUnlink} size='small' type='button'>
              {sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.recoveryUnlink)}
            </Button>
          </div>
        )}
      </div>
    </Banner>
  )
}
