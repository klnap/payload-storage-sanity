'use client'

import {
  Button,
  CopyToClipboard,
  Drawer,
  EditUpload,
  TextInput,
  Upload,
  useConfig,
  useDocumentInfo,
  useField,
  useForm,
  useFormModified,
  useLocale,
  useModal,
  useTranslation,
  useUploadEdits,
} from '@payloadcms/ui'
import type { ClientCollectionConfig, SanitizedCollectionConfig, UploadEdits } from 'payload'
import { formatFilesize } from 'payload/shared'
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'
import { applyImageParams } from '@/features/media/cdn'
import type { SanityMediaDocument } from '@/features/media/document'
import { resolveLocalizedAlt } from '@/features/media/populate/metadata'
import { getSanityAssetMetadata } from '@/sanity/assets'
import { isPersistedHttpUrl, isSanityCompatibleHost } from '@/sanity/cdn'
import { FileTypeIcon } from '../file-type/FileTypeIcon'
import { MetaIcon, type MetaIconName } from '../file-type/MetaIcon'
import { presentMedia } from '../gallery/media'
import { safeAssetHref } from './safe-asset-href'

type UploadConfig = Exclude<SanitizedCollectionConfig['upload'], undefined | boolean>

function asUploadConfig(value: unknown): UploadConfig | null {
  if (value == null || value === true || value === false || typeof value !== 'object') {
    return null
  }
  return value as UploadConfig
}

export function canEditAssetPreview(
  isSVG: boolean,
  uploadConfig: Pick<UploadConfig, 'crop' | 'focalPoint'>
): boolean {
  return !isSVG && Boolean(uploadConfig.crop || uploadConfig.focalPoint)
}

export function shouldRenderAssetPreview(
  id: unknown,
  src: string | undefined,
  replacing = false
): boolean {
  return id != null && Boolean(src) && !replacing
}

export function shouldShowBlurPlaceholder(loading: boolean, failed: boolean): boolean {
  return loading && !failed
}

export function shouldHideNativeUpload(mimeType: string | undefined): boolean {
  return mimeType?.startsWith('image/') ?? false
}

export function getPreviewAspectRatio(width: number | undefined, height: number | undefined) {
  return width &&
    height &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? `${width} / ${height}`
    : undefined
}

export function canReplaceAssetFile(
  canUpdate: boolean | undefined,
  hideRemoveFile: boolean | undefined
): boolean {
  return Boolean(canUpdate) && !hideRemoveFile
}

export function extractDuplicateMediaId(message: string | undefined): string | undefined {
  return message?.match(/^This file is already in your media library \(ID ([^)]+)\)\./)?.[1]
}

const previewMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
])

function resolveCropRect(
  crop: UploadEdits['crop'] | undefined,
  sourceWidth: number,
  sourceHeight: number
) {
  if (!crop || sourceWidth <= 0 || sourceHeight <= 0) return undefined
  const scaleX = crop.unit === 'px' ? 1 : sourceWidth / 100
  const scaleY = crop.unit === 'px' ? 1 : sourceHeight / 100
  const left = Math.max(0, Math.min(sourceWidth - 1, Math.round(crop.x * scaleX)))
  const top = Math.max(0, Math.min(sourceHeight - 1, Math.round(crop.y * scaleY)))
  const width = Math.max(1, Math.min(sourceWidth - left, Math.round(crop.width * scaleX)))
  const height = Math.max(1, Math.min(sourceHeight - top, Math.round(crop.height * scaleY)))
  return { left, top, width, height }
}

function AssetPreview({
  alt,
  height,
  lqip,
  canEdit,
  canReplace,
  isReplacing,
  onEdit,
  onReplace,
  replaceFileLabel,
  src,
  width,
}: {
  alt: string
  height?: number
  lqip?: string
  canEdit: boolean
  canReplace: boolean
  isReplacing: boolean
  onEdit: () => void
  onReplace: () => void
  replaceFileLabel: string
  src?: string
  width?: number
}) {
  const [failed, setFailed] = useState(false)
  const [displayedSrc, setDisplayedSrc] = useState(src)
  const [loadedSrc, setLoadedSrc] = useState<string>()
  const [naturalSize, setNaturalSize] = useState<{ src: string; width: number; height: number }>()
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const image = imageRef.current
    if (displayedSrc && image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      setLoadedSrc(displayedSrc)
      setNaturalSize({
        src: displayedSrc,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
  }, [displayedSrc])

  useEffect(() => {
    if (!src || src === displayedSrc) return

    const nextImage = new Image()
    setFailed(false)
    nextImage.onload = () => {
      setDisplayedSrc(src)
      setLoadedSrc(src)
      setFailed(false)
    }
    nextImage.onerror = () => setFailed(true)
    nextImage.src = src

    return () => {
      nextImage.onload = null
      nextImage.onerror = null
    }
  }, [displayedSrc, src])
  const loading = Boolean(src && !loadedSrc && !failed)

  return (
    <div className='group relative isolate my-4 flex h-[min(360px,45svh)] w-full min-w-0 items-center justify-center overflow-hidden bg-[var(--theme-elevation-50)] py-4 md:h-[min(600px,60svh)]'>
      {displayedSrc && !failed ? (
        <div
          className='relative flex h-full max-w-full items-center justify-center overflow-hidden'
          style={{
            aspectRatio: getPreviewAspectRatio(
              width ?? (naturalSize?.src === displayedSrc ? naturalSize.width : undefined),
              height ?? (naturalSize?.src === displayedSrc ? naturalSize.height : undefined)
            ),
          }}
        >
          {lqip && shouldShowBlurPlaceholder(loading, failed) ? (
            <img
              alt=''
              aria-hidden='true'
              className='absolute inset-0 size-full object-cover blur-xl'
              src={lqip}
            />
          ) : null}
          <img
            alt={alt}
            className={`relative z-10 block h-full w-auto max-w-full object-contain ${loadedSrc === displayedSrc ? 'opacity-100' : 'opacity-0'}`}
            decoding='async'
            height={height}
            loading='eager'
            onError={() => {
              if (displayedSrc === src) setFailed(true)
            }}
            onLoad={() => {
              const image = imageRef.current
              if (image?.naturalWidth && image.naturalHeight) {
                setNaturalSize({
                  src: displayedSrc,
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                })
              }
              setLoadedSrc(displayedSrc)
              setFailed(false)
            }}
            ref={imageRef}
            src={displayedSrc}
            width={width}
          />
        </div>
      ) : loading && !lqip ? (
        <span
          aria-label='Loading image'
          className='absolute size-8 animate-spin rounded-full border-2 border-(--theme-elevation-500) border-t-transparent'
          role='status'
        />
      ) : failed ? (
        <p className='m-0 px-3 py-4 text-sm text-[var(--theme-elevation-700)]'>
          Image preview unavailable.
        </p>
      ) : null}
      {displayedSrc && canEdit && (
        <div className='absolute right-2 top-2 z-20'>
          <Button
            aria-label='Edit image'
            buttonStyle='icon-label'
            icon='edit'
            iconStyle='none'
            margin={false}
            onClick={onEdit}
            size='large'
          />
        </div>
      )}
      {displayedSrc && canReplace && (
        <div className='absolute left-2 top-2 z-20'>
          <Button
            aria-label={isReplacing ? 'Revert replacement' : replaceFileLabel}
            buttonStyle='icon-label'
            icon={isReplacing ? 'x' : 'swap'}
            iconStyle='none'
            margin={false}
            onClick={onReplace}
            size='large'
          />
        </div>
      )}
    </div>
  )
}

/** Rendered inside Payload's native file card: original name, link, then metadata icons. */
function NativeFileMeta({ data }: { data?: SanityMediaDocument | null }) {
  const media = presentMedia((data ?? {}) as Record<string, unknown>)
  const url = typeof data?.url === 'string' ? data.url : undefined
  const name =
    media.originalName || (typeof data?.filename === 'string' ? data.filename : undefined)
  const type = typeof data?.mimeType === 'string' ? data.mimeType : undefined

  return (
    <div className='flex min-w-0 flex-col' style={{ gap: 12 }} data-pss-file-meta=''>
      {url ? (
        <div className='flex min-w-0 items-start gap-2 text-base'>
          <a
            className='min-w-0 break-all text-base font-medium text-(--theme-elevation-700) no-underline'
            href={safeAssetHref(url)}
            rel='noopener noreferrer'
            target='_blank'
          >
            {url}
          </a>
          <CopyToClipboard defaultMessage='Copy URL' value={url} />
        </div>
      ) : null}
      {name ? (
        <span className='break-all text-base text-(--theme-elevation-700)'>{name}</span>
      ) : null}
      <div
        className='text-sm text-(--theme-elevation-700)'
        style={{ display: 'flex', flexWrap: 'wrap', columnGap: 32, rowGap: 8, marginTop: 12 }}
      >
        {typeof data?.filesize === 'number' ? (
          <MetaItem icon='size' label='Size' value={formatFilesize(data.filesize)} />
        ) : null}
        {type ? <MetaItem icon='type' label='Type' value={type} /> : null}
      </div>
    </div>
  )
}

function MetaItem({
  icon,
  label,
  strong,
  value,
}: {
  icon: MetaIconName
  label: string
  strong?: boolean
  value: string
}) {
  return (
    <span
      className={`inline-flex items-center ${strong ? 'break-all text-base font-medium text-(--theme-elevation-900)' : ''}`}
      style={{ gap: 8 }}
      title={label}
    >
      <MetaIcon label={label} name={icon} />
      {value}
    </span>
  )
}

function AssetMetadata({
  data,
  selectedFile,
  onReplace,
  replaceFileLabel,
}: {
  data?: SanityMediaDocument | null
  selectedFile?: File
  onReplace?: () => void
  replaceFileLabel?: string
}) {
  const filename =
    selectedFile?.name ?? (typeof data?.filename === 'string' ? data.filename : undefined)
  const url = typeof data?.url === 'string' ? data.url : undefined
  const originalFilename =
    selectedFile?.name ??
    (presentMedia((data ?? {}) as Record<string, unknown>).originalName || filename)
  const size = selectedFile
    ? formatFilesize(selectedFile.size)
    : typeof data?.filesize === 'number'
      ? formatFilesize(data.filesize)
      : undefined
  const dimensions =
    typeof data?.width === 'number' && typeof data?.height === 'number'
      ? `${data.width} × ${data.height}`
      : undefined
  const ratio =
    typeof data?.width === 'number' &&
    typeof data?.height === 'number' &&
    Number.isInteger(data.width) &&
    Number.isInteger(data.height) &&
    data.width > 0 &&
    data.height > 0
      ? `${data.width / gcd(data.width, data.height)}:${data.height / gcd(data.width, data.height)}`
      : undefined
  const type =
    selectedFile?.type || (typeof data?.mimeType === 'string' ? data.mimeType : undefined)
  const details: { icon: MetaIconName; label: string; value: string }[] = [
    ...(size ? [{ icon: 'size' as const, label: 'Size', value: size }] : []),
    ...(dimensions
      ? [{ icon: 'dimensions' as const, label: 'Dimensions', value: dimensions }]
      : []),
    ...(ratio ? [{ icon: 'ratio' as const, label: 'Aspect ratio', value: ratio }] : []),
    ...(type ? [{ icon: 'type' as const, label: 'Type', value: type }] : []),
  ]

  return (
    <div
      className='-mx-[var(--gutter-h)] w-[calc(100%+var(--gutter-h)+var(--gutter-h))] px-[var(--gutter-h)] py-4'
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {url ? (
        <div className='flex min-w-0 items-start gap-3'>
          <a
            className='min-w-0 break-all text-base font-medium text-(--theme-elevation-700) no-underline'
            href={safeAssetHref(url)}
            rel='noopener noreferrer'
            target='_blank'
          >
            {url}
          </a>
          <CopyToClipboard defaultMessage='Copy URL' value={url} />
        </div>
      ) : filename ? (
        <span className='font-medium text-(--theme-elevation-900)'>{filename}</span>
      ) : (
        <div
          aria-label='Loading image details'
          className='h-4 w-64 animate-pulse rounded-sm bg-(--theme-elevation-150)'
          role='status'
        />
      )}
      {originalFilename && (url || selectedFile) ? (
        <div className='break-all text-base text-(--theme-elevation-700)'>{originalFilename}</div>
      ) : null}
      {details.length > 0 ? (
        <div
          className='flex flex-wrap text-base text-(--theme-elevation-700)'
          style={{ columnGap: 32, rowGap: 8 }}
        >
          {details.map((detail) => (
            <MetaItem key={detail.label} {...detail} />
          ))}
        </div>
      ) : (
        <div
          aria-hidden='true'
          className='mt-2 h-3 w-40 animate-pulse rounded-sm bg-(--theme-elevation-100)'
        />
      )}
      {onReplace && replaceFileLabel ? (
        <Button
          aria-label={replaceFileLabel}
          buttonStyle='icon-label'
          icon='swap'
          iconStyle='none'
          margin={false}
          onClick={onReplace}
          size='medium'
        />
      ) : null}
    </div>
  )
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function useLocalImagePreview(file: File | undefined): string | undefined {
  const [preview, setPreview] = useState<{ file: File; src: string }>()

  useEffect(() => {
    if (!file?.type.startsWith('image/')) return

    const src = URL.createObjectURL(file)
    setPreview({ file, src })
    return () => URL.revokeObjectURL(src)
  }, [file])

  return preview && preview.file === file ? preview.src : undefined
}

function AssetTitleInput({ label }: { label: string }) {
  const { disabled, setValue, showError, value } = useField<string>({ path: 'title' })

  return (
    <TextInput
      label={label}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
      path='title'
      readOnly={disabled}
      showError={showError}
      value={value ?? ''}
    />
  )
}

/** Keep Payload's native upload UI and add a large preview to the media detail view. */
export function MediaAssetUpload({
  cdnBaseUrl,
  titleInput = false,
}: {
  cdnBaseUrl?: string
  titleInput?: boolean
} = {}) {
  const { collectionSlug, data, docPermissions, id, initialState, docConfig } = useDocumentInfo()
  const { getEntityConfig } = useConfig()
  const { code } = useLocale()
  const { t } = useTranslation()
  const { uploadEdits, resetUploadEdits, updateUploadEdits } = useUploadEdits()
  const { getData, setModified } = useForm()
  const { openModal, closeModal } = useModal()
  const formModified = useFormModified()
  const [replacingFile, setReplacingFile] = useState(false)
  const [uploadKey, setUploadKey] = useState(0)
  const {
    errorMessage,
    setValue: setFileValue,
    showError,
    value: fileValue,
  } = useField<File | null>({ path: 'file' })
  const uploadRoot = useRef<HTMLDivElement>(null)
  const nativeRemoveClick = useRef(false)
  const [metaHost, setMetaHost] = useState<Element | null>(null)
  const [thumbHost, setThumbHost] = useState<Element | null>(null)
  useEffect(() => {
    const root = uploadRoot.current
    if (!root) return
    // Payload owns the native card's DOM; we only append our metadata into its meta slot.
    const find = () => {
      setMetaHost(root.querySelector('.file-details .file-meta'))
      setThumbHost(root.querySelector('.file-details__thumbnail'))
    }
    find()
    const observer = new MutationObserver(find)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  const duplicateId = showError ? extractDuplicateMediaId(errorMessage) : undefined
  const selectedFile =
    typeof File !== 'undefined' && fileValue instanceof File ? fileValue : undefined
  const localPreviewSrc = useLocalImagePreview(selectedFile)
  const savedEdits = useRef(JSON.stringify(uploadEdits ?? {}))
  const editsBeforeReplace = useRef(uploadEdits)
  const pristineBeforeReplace = useRef(false)
  const dataBeforeReplace = useRef('')
  const savedUpdatedAt = useRef(data?.updatedAt)
  const openNativeEditor = useCallback(() => {
    if (id != null && localPreviewSrc) {
      openModal('sanity-replacement-edit')
      return
    }
    uploadRoot.current?.querySelector<HTMLButtonElement>('.file-field__edit')?.click()
  }, [id, localPreviewSrc, openModal])
  const openFileReplacement = useCallback(() => {
    if (replacingFile && id != null) {
      const { file: _file, ...otherData } = getData()
      setFileValue(undefined, true)
      resetUploadEdits()
      updateUploadEdits(editsBeforeReplace.current)
      setReplacingFile(false)
      setUploadKey((key) => key + 1)
      if (
        pristineBeforeReplace.current &&
        JSON.stringify(otherData) === dataBeforeReplace.current
      ) {
        setModified(false)
      }
      return
    }
    const { file: _file, ...otherData } = getData()
    pristineBeforeReplace.current = !formModified
    dataBeforeReplace.current = JSON.stringify(otherData)
    editsBeforeReplace.current = uploadEdits
    setReplacingFile(true)
    const selector = selectedFile ? '.file-field__remove' : '.file-details__remove'
    uploadRoot.current?.querySelector<HTMLButtonElement>(selector)?.click()
    if (!formModified && id != null) setModified(false)
  }, [
    formModified,
    getData,
    id,
    replacingFile,
    resetUploadEdits,
    selectedFile,
    setFileValue,
    setModified,
    updateUploadEdits,
    uploadEdits,
  ])

  useEffect(() => {
    if (!formModified) {
      savedEdits.current = JSON.stringify(uploadEdits ?? {})
    }
  }, [formModified, uploadEdits])

  useEffect(() => {
    if (savedUpdatedAt.current !== data?.updatedAt) {
      savedUpdatedAt.current = data?.updatedAt
      setReplacingFile(false)
    }
  }, [data?.updatedAt])

  const entityConfig =
    typeof collectionSlug === 'string' ? getEntityConfig({ collectionSlug }) : null
  const uploadConfig =
    asUploadConfig(
      docConfig && 'upload' in docConfig ? (docConfig as ClientCollectionConfig).upload : undefined
    ) ??
    asUploadConfig(entityConfig && 'upload' in entityConfig ? entityConfig.upload : undefined) ??
    ({} as UploadConfig)

  if (!collectionSlug) return null

  const mime = typeof data?.mimeType === 'string' ? data.mimeType.toLowerCase() : ''
  const url: unknown = data?.url
  const safeUrl =
    isPersistedHttpUrl(url) ||
    (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\'))
  const original = safeUrl && previewMimes.has(mime) ? url : undefined
  const isSVG =
    mime === 'image/svg+xml' || /\.svg(?:$|[?#\s])/i.test(`${data?.filename ?? ''} ${url ?? ''}`)
  const lqip =
    getSanityAssetMetadata(data as SanityMediaDocument)?.lqip?.trim() ||
    (typeof data?.lqip === 'string' ? data.lqip : undefined) ||
    (typeof data?.thumbnailURL === 'string' ? data.thumbnailURL : undefined)
  const hasPendingEdits = formModified && JSON.stringify(uploadEdits ?? {}) !== savedEdits.current
  const cropRect =
    hasPendingEdits && typeof data?.width === 'number' && typeof data?.height === 'number'
      ? resolveCropRect(uploadEdits?.crop, data.width, data.height)
      : undefined
  const previewSrc =
    original && mime !== 'image/svg+xml' && isSanityCompatibleHost(original, { cdnBaseUrl })
      ? applyImageParams(original, {
          width: 1920,
          height: 1200,
          fit: 'max',
          autoFormat: mime !== 'image/gif',
          ...(cropRect ? { rect: cropRect } : {}),
        })
      : original
  const replaceFileLabel = sanityStorageTranslate(
    t as SanityStorageTranslateFn,
    SANITY_STORAGE_I18N_KEYS.uploadReplaceFile
  )
  const canReplace = canReplaceAssetFile(docPermissions?.update, uploadConfig.hideRemoveFile)
  const hasPreview = shouldRenderAssetPreview(id, previewSrc, replacingFile)
  // Every other file type (text, office, audio, video, archives…) gets an icon panel instead of a blank area.
  const hasFilePanel = id != null && !replacingFile && safeUrl && !original
  const showPreview = hasPreview || Boolean(localPreviewSrc)
  const selectedImage = shouldHideNativeUpload(selectedFile?.type)
  const uploadRootClass = [
    'relative',
    hasFilePanel ? 'pss-native-file' : '[&_.file-details]:hidden',
    duplicateId && '[&_.field-error]:pr-10',
    selectedImage && String.raw`[&_.file-field\_\_upload]:hidden`,
    !showPreview && '[&_.file-field]:!my-4',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <>
      {titleInput && (
        <div className='mb-4'>
          <AssetTitleInput
            label={sanityStorageTranslate(
              t as SanityStorageTranslateFn,
              SANITY_STORAGE_I18N_KEYS.fieldAssetTitleLabel
            )}
          />
        </div>
      )}
      {(hasPreview || localPreviewSrc) && (
        <AssetPreview
          alt={
            localPreviewSrc
              ? selectedFile?.name || 'Asset preview'
              : resolveLocalizedAlt(data?.alt, { locale: code }) ||
                data?.filename ||
                'Asset preview'
          }
          height={
            localPreviewSrc
              ? undefined
              : (cropRect?.height ?? (typeof data?.height === 'number' ? data.height : undefined))
          }
          lqip={localPreviewSrc ? undefined : lqip}
          canEdit={canEditAssetPreview(
            localPreviewSrc ? selectedFile?.type === 'image/svg+xml' : isSVG,
            uploadConfig
          )}
          canReplace={id != null ? canReplace : !uploadConfig.hideRemoveFile}
          isReplacing={replacingFile && id != null}
          onEdit={openNativeEditor}
          onReplace={openFileReplacement}
          replaceFileLabel={replaceFileLabel}
          src={localPreviewSrc ?? previewSrc}
          width={
            localPreviewSrc
              ? undefined
              : (cropRect?.width ?? (typeof data?.width === 'number' ? data.width : undefined))
          }
        />
      )}
      {id != null && !replacingFile && !hasFilePanel && (
        <AssetMetadata
          data={data as SanityMediaDocument | null | undefined}
          onReplace={canReplace && !hasPreview ? openFileReplacement : undefined}
          replaceFileLabel={replaceFileLabel}
        />
      )}
      <div
        className={uploadRootClass}
        onClickCapture={(event) => {
          // Native X must go through the replacement flow so it can be reverted and keeps the form unmodified.
          if (
            hasFilePanel &&
            !nativeRemoveClick.current &&
            (event.target as HTMLElement).closest('.file-details__remove')
          ) {
            event.preventDefault()
            event.stopPropagation()
            nativeRemoveClick.current = true
            openFileReplacement()
            nativeRemoveClick.current = false
          }
        }}
        ref={uploadRoot}
      >
        {replacingFile && !showPreview && id != null ? (
          <div className='mb-2 flex justify-start'>
            <Button
              aria-label='Revert replacement'
              buttonStyle='secondary'
              margin={false}
              onClick={openFileReplacement}
              size='medium'
              type='button'
            >
              Revert
            </Button>
          </div>
        ) : null}
        <Upload
          key={uploadKey}
          collectionSlug={collectionSlug}
          initialState={initialState}
          uploadConfig={uploadConfig}
        />
        {hasFilePanel && thumbHost
          ? createPortal(
              <span data-pss-icon='' className='flex items-center justify-center'>
                <FileTypeIcon
                  extension={presentMedia((data ?? {}) as Record<string, unknown>).extension}
                  family={presentMedia((data ?? {}) as Record<string, unknown>).family}
                  size={64}
                />
              </span>,
              thumbHost
            )
          : null}
        {hasFilePanel && metaHost
          ? createPortal(
              <NativeFileMeta data={data as SanityMediaDocument | null | undefined} />,
              metaHost
            )
          : null}
        {duplicateId ? (
          <div className='absolute right-1 z-10' style={{ top: 'calc(var(--base) * -1.25 - 6px)' }}>
            <CopyToClipboard value={duplicateId} />
          </div>
        ) : null}
      </div>
      {(id == null && selectedFile) || (replacingFile && selectedFile) ? (
        <AssetMetadata selectedFile={selectedFile} />
      ) : null}
      {id != null && localPreviewSrc && selectedFile ? (
        <Drawer Header={null} slug='sanity-replacement-edit'>
          <div
            onClickCapture={(event) => {
              if ((event.target as HTMLElement).closest('.edit-upload__cancel')) {
                closeModal('sanity-replacement-edit')
              }
            }}
          >
            <EditUpload
              fileName={selectedFile.name}
              fileSrc={localPreviewSrc}
              initialCrop={uploadEdits?.crop ?? undefined}
              initialFocalPoint={uploadEdits?.focalPoint ?? { x: 50, y: 50 }}
              onSave={(edits) => {
                setModified(true)
                updateUploadEdits(edits)
                closeModal('sanity-replacement-edit')
              }}
              showCrop={uploadConfig.crop !== false}
              showFocalPoint={Boolean(uploadConfig.focalPoint)}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  )
}
