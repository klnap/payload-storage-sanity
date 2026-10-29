'use client'

/**
 * Future upgrade — large CDN hero preview + ⋮ → native Edit Image.
 * Not wired into the plugin; keep for a later opt-in. Active upload UI is
 * {@link MediaAssetUpload} (native Payload Upload).
 */

import {
  Button,
  MoreIcon,
  Upload,
  useConfig,
  useDocumentInfo,
  useUploadEdits,
} from '@payloadcms/ui'
import type { ClientCollectionConfig, SanitizedCollectionConfig, UploadEdits } from 'payload'
import React, { useCallback, useMemo } from 'react'

import { mediaAssetUploadStyles } from './mediaAssetUploadHero.styles'

type UploadConfig = Exclude<SanitizedCollectionConfig['upload'], undefined | boolean>

type PercentCrop = {
  x?: number
  y?: number
  width?: number
  height?: number
  unit?: string
}

function isImageMime(mime: unknown): boolean {
  return typeof mime === 'string' && mime.startsWith('image/') && mime !== 'image/svg+xml'
}

/** Larger CDN preview than list thumbnail (`w=300`) — still bounded for admin. */
function previewSrcFromPublicUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('w', '1600')
    parsed.searchParams.set('fit', 'max')
    parsed.searchParams.set('auto', 'format')
    return parsed.toString()
  } catch {
    return url
  }
}

function asUploadConfig(value: unknown): UploadConfig | null {
  if (value == null || value === true || value === false || typeof value !== 'object') {
    return null
  }
  return value as UploadConfig
}

function asPercentCrop(crop: UploadEdits['crop'] | undefined): PercentCrop | null {
  if (crop == null || typeof crop !== 'object') return null
  const c = crop as PercentCrop
  if (
    typeof c.width !== 'number' ||
    typeof c.height !== 'number' ||
    typeof c.x !== 'number' ||
    typeof c.y !== 'number'
  ) {
    return null
  }
  if (c.x <= 0.5 && c.y <= 0.5 && c.width >= 99 && c.height >= 99) {
    return null
  }
  return c
}

function resolveFocalPercent(
  uploadEdits: UploadEdits | undefined,
  data: { focalX?: unknown; focalY?: unknown } | null | undefined
): { x: number; y: number } {
  const fromEdits = uploadEdits?.focalPoint
  const x =
    typeof fromEdits?.x === 'number'
      ? fromEdits.x
      : typeof data?.focalX === 'number'
        ? data.focalX
        : 50
  const y =
    typeof fromEdits?.y === 'number'
      ? fromEdits.y
      : typeof data?.focalY === 'number'
        ? data.focalY
        : 50
  return { x, y }
}

/**
 * Parked hero Upload — same wiring as `MediaAssetUpload`, plus CDN preview card.
 * Enable later via `admin.components.edit.Upload` → this export.
 */
export function MediaAssetUploadHero() {
  const { data, collectionSlug, initialState, docConfig } = useDocumentInfo()
  const { getEntityConfig } = useConfig()
  const { uploadEdits } = useUploadEdits()
  const rootRef = React.useRef<HTMLDivElement>(null)

  const entityConfig =
    typeof collectionSlug === 'string' ? getEntityConfig({ collectionSlug }) : null

  const uploadConfig =
    asUploadConfig(
      docConfig && 'upload' in docConfig ? (docConfig as ClientCollectionConfig).upload : undefined
    ) ??
    asUploadConfig(entityConfig && 'upload' in entityConfig ? entityConfig.upload : undefined) ??
    ({} as UploadConfig)

  const filename = typeof data?.filename === 'string' ? data.filename : null
  const mimeType = data?.mimeType
  const publicUrl = typeof data?.url === 'string' && data.url.trim().length > 0 ? data.url : null
  const showHero = Boolean(filename && publicUrl && isImageMime(mimeType))

  const focal = useMemo(
    () => resolveFocalPercent(uploadEdits, data as { focalX?: unknown; focalY?: unknown }),
    [uploadEdits, data]
  )
  const pendingCrop = useMemo(() => asPercentCrop(uploadEdits?.crop), [uploadEdits?.crop])
  const styles = mediaAssetUploadStyles({
    hero: showHero,
    cropped: Boolean(pendingCrop),
  })

  const cropFrameStyle = useMemo((): React.CSSProperties | undefined => {
    if (!pendingCrop) return undefined
    return {
      aspectRatio: `${pendingCrop.width} / ${pendingCrop.height}`,
    }
  }, [pendingCrop])

  const heroImgStyle = useMemo((): React.CSSProperties => {
    if (pendingCrop) {
      const w = pendingCrop.width || 100
      const h = pendingCrop.height || 100
      const x = pendingCrop.x ?? 0
      const y = pendingCrop.y ?? 0
      return {
        width: `${100 / (w / 100)}%`,
        height: `${100 / (h / 100)}%`,
        left: `${(-x / w) * 100}%`,
        top: `${(-y / h) * 100}%`,
      }
    }
    return {
      objectPosition: `${focal.x}% ${focal.y}%`,
    }
  }, [focal.x, focal.y, pendingCrop])

  const openNativeEditImage = useCallback(() => {
    const editButton = rootRef.current?.querySelector<HTMLButtonElement>('.file-field__edit')
    editButton?.click()
  }, [])

  if (!collectionSlug) {
    return null
  }

  return (
    <div ref={rootRef} className={styles.root()}>
      {showHero && publicUrl ? (
        <div className={styles.hero()}>
          {pendingCrop ? (
            <div className={styles.cropFrame()} style={cropFrameStyle}>
              <img
                className={styles.img()}
                src={previewSrcFromPublicUrl(publicUrl)}
                alt={filename ?? ''}
                style={heroImgStyle}
              />
            </div>
          ) : (
            <img
              className={styles.img()}
              src={previewSrcFromPublicUrl(publicUrl)}
              alt={filename ?? ''}
              style={heroImgStyle}
            />
          )}
          <Button
            aria-label='Edit image'
            buttonStyle='tab'
            className={styles.menu()}
            icon={<MoreIcon />}
            iconStyle='none'
            margin={false}
            onClick={openNativeEditImage}
            size='medium'
          />
        </div>
      ) : null}

      <Upload
        collectionSlug={collectionSlug}
        initialState={initialState}
        uploadConfig={uploadConfig}
      />
    </div>
  )
}
