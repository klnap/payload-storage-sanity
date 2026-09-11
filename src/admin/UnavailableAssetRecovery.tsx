'use client'

import { Banner, Button } from '@payloadcms/ui'

import type { SanitySyncStatus } from '../sync/status'

type UnavailableAssetRecoveryProps = {
  mediaId?: number | null
  onReplace: () => void
  onUnlink: () => void
  readOnly?: boolean
  status?: SanitySyncStatus | null
}

function statusMessage(status: SanitySyncStatus | null | undefined): string {
  switch (status) {
    case 'deleted':
      return 'This asset was deleted upstream. Replace it with a new upload or unlink the reference.'
    case 'error':
      return 'Could not verify this asset. Replace it with a new upload or unlink the reference.'
    case 'missing':
      return 'This asset is missing or unavailable. Replace it with a new upload or unlink the reference.'
    default:
      return 'This media reference is unavailable. Replace it with a new upload or unlink the reference.'
  }
}

export function UnavailableAssetRecovery({
  mediaId,
  onReplace,
  onUnlink,
  readOnly,
  status,
}: UnavailableAssetRecoveryProps) {
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
          {statusMessage(status)}
          {mediaId != null && (
            <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>(ID: {mediaId})</span>
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
              Replace
            </Button>
            <Button buttonStyle='secondary' onClick={onUnlink} size='small' type='button'>
              Unlink
            </Button>
          </div>
        )}
      </div>
    </Banner>
  )
}
