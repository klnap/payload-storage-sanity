'use client'

import { FieldLabel } from '@payloadcms/ui'
import type { SanityMediaDocument } from '@/features/media/document'
import { getSanityAssetFromMedia } from '@/sanity/assets'
import { MetaIcon, type MetaIconName } from '../file-type/MetaIcon'
import {
  mediaMetadataSwatchGridStyles,
  mediaMetadataSwatchStyles,
} from './mediaMetadataInspector.styles'

type Props = {
  asset: unknown
}

type Swatch = {
  background?: string
  foreground?: string
  population?: number
  title?: string
}

function formatBytes(size: unknown): string | null {
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return null
  }
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function MetaRow({ icon, label, value }: { icon?: MetaIconName; label: string; value: unknown }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt className='flex items-center gap-1.5 text-[var(--theme-elevation-500)]'>
        {icon ? <MetaIcon label={label} name={icon} /> : null}
        {label}
      </dt>
      <dd className='break-all'>{String(value)}</dd>
    </div>
  )
}

export function MediaMetadataInspectorClient({ asset }: Props) {
  const doc: SanityMediaDocument = { sanity: { asset: asset as never } }
  const persisted = getSanityAssetFromMedia(doc)
  if (!persisted) {
    return (
      <div className='field-type'>
        <FieldLabel label='Metadata' />
        <p className='text-[var(--theme-elevation-500)]'>No upstream asset metadata yet.</p>
      </div>
    )
  }

  const metadata = persisted.metadata as Record<string, unknown> | undefined
  const dimensions = metadata?.dimensions as
    | { width?: number; height?: number; aspectRatio?: number }
    | undefined
  const palette = metadata?.palette as Record<string, Swatch> | undefined
  const lqip = typeof metadata?.lqip === 'string' ? metadata.lqip : null

  const gridClass = mediaMetadataSwatchGridStyles()
  const swatchClass = mediaMetadataSwatchStyles()

  return (
    <div className='flex flex-col gap-[calc(var(--base)*1.25)]'>
      <section>
        <dl className='grid grid-cols-1 gap-2 text-sm md:grid-cols-2'>
          <MetaRow icon='filename' label='Original filename' value={persisted.originalFilename} />
          <MetaRow icon='type' label='MIME type' value={persisted.mimeType} />
          <MetaRow icon='extension' label='Extension' value={persisted.extension} />
          <MetaRow icon='size' label='Size' value={formatBytes(persisted.size)} />
          <MetaRow icon='id' label='Asset ID' value={persisted._id} />
          <MetaRow icon='hash' label='SHA-1' value={persisted.sha1hash} />
          <MetaRow icon='link' label='CDN URL' value={persisted.url} />
          <MetaRow icon='path' label='CDN path' value={persisted.path} />
        </dl>
      </section>

      {dimensions != null && (
        <section>
          <FieldLabel label='Dimensions' />
          <dl className='grid grid-cols-1 gap-2 text-sm md:grid-cols-2'>
            <MetaRow icon='dimensions' label='Width' value={dimensions.width} />
            <MetaRow icon='dimensions' label='Height' value={dimensions.height} />
            <MetaRow icon='ratio' label='Aspect ratio' value={dimensions.aspectRatio} />
          </dl>
        </section>
      )}

      {lqip != null && (
        <section>
          <FieldLabel label='LQIP' />
          <img
            alt=''
            className='mb-2 max-w-[120px] rounded border border-[var(--theme-elevation-150)]'
            height={120}
            src={lqip}
            width={120}
          />
        </section>
      )}

      {palette != null && Object.keys(palette).length > 0 && (
        <section>
          <FieldLabel label='Palette' />
          <div className={gridClass}>
            {Object.entries(palette).map(([role, sw]) => {
              const bg = sw?.background
              if (!bg) return null
              return (
                <div
                  key={role}
                  className={swatchClass}
                  role='img'
                  style={{ backgroundColor: bg }}
                  title={`${role}: ${bg}`}
                  aria-label={`${role} ${bg}`}
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
