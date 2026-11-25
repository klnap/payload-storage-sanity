import { Button } from '@base-ui/react/button'
import { Tooltip } from '@base-ui/react/tooltip'
import { CheckboxInput, Link } from '@payloadcms/ui'
import { useId, useState } from 'react'
import { tv } from 'tailwind-variants/lite'
import { FileTypeIcon } from '../file-type/FileTypeIcon'
import { justifiedRatio, maxTileWidth, type TileSize, targetHeight, tileRatio } from './justified'
import type { presentMedia } from './media'

type Media = ReturnType<typeof presentMedia>
export type GalleryLayout = 'justified' | 'grid'

const reveal =
  'kmg:pointer-fine:opacity-0 kmg:group-hover/card:opacity-100 kmg:group-focus-within/card:opacity-100 kmg:motion-safe:transition-opacity'

const card = tv({
  slots: {
    tile: 'kmg:group/card kmg:relative kmg:box-border kmg:shrink-0',
    action:
      'kmg:relative kmg:block kmg:size-full kmg:cursor-pointer kmg:overflow-hidden kmg:border-0 kmg:bg-transparent kmg:p-0 kmg:text-inherit kmg:no-underline kmg:focus-visible:outline-2 kmg:focus-visible:-outline-offset-2 kmg:focus-visible:outline-(--theme-elevation-700)',
    tooltip:
      'kmg:max-w-sm kmg:rounded-sm kmg:bg-(--theme-elevation-900) kmg:px-3 kmg:py-1.5 kmg:text-sm kmg:wrap-break-word kmg:text-(--theme-elevation-0)',
    footer:
      'kmg:pointer-events-none kmg:absolute kmg:inset-x-0 kmg:bottom-0 kmg:block kmg:px-2 kmg:pb-1.5 kmg:text-xs kmg:break-all kmg:font-medium kmg:text-(--theme-elevation-800)',
    checkbox: [
      'kmg:absolute kmg:start-1 kmg:top-1 kmg:grid kmg:size-7 kmg:max-w-[80%] kmg:place-items-center kmg:text-white kmg:outline-offset-1 kmg:focus-visible:outline-2',
      reveal,
    ],
  },
  variants: {
    layout: {
      justified: {},
      grid: { tile: 'kmg:aspect-[4/3]' },
    },
    selected: {
      true: {
        tile: 'kmg:after:pointer-events-none kmg:after:absolute kmg:after:inset-0 kmg:after:border-2 kmg:after:border-solid kmg:after:border-white',
      },
    },
    disabled: {
      true: { checkbox: 'kmg:cursor-not-allowed kmg:text-white/60' },
      false: { checkbox: 'kmg:cursor-pointer' },
    },
  },
})

const preview = tv({
  slots: {
    frame: 'kmg:absolute kmg:inset-0 kmg:grid kmg:place-items-center',
    image: 'kmg:absolute kmg:inset-0 kmg:block kmg:size-full',
    message: 'kmg:max-w-full kmg:truncate kmg:px-1 kmg:text-xs kmg:text-(--theme-elevation-800)',
    // Bottom padding keeps the artwork centred above the filename footer.
    file: 'kmg:grid kmg:justify-items-center kmg:gap-2 kmg:px-3 kmg:pb-9 kmg:text-(--theme-elevation-600)',
    fileIcon: 'kmg:size-24',
    fileFormat:
      'kmg:max-w-full kmg:truncate kmg:text-xs kmg:font-medium kmg:text-(--theme-elevation-800)',
  },
  variants: {
    fit: {
      cover: { image: 'kmg:object-cover' },
      contain: { image: 'kmg:object-contain' },
    },
    status: {
      available: {},
      unavailable: { frame: 'kmg:bg-(--theme-elevation-100)' },
    },
  },
})

function FileArtwork({ extension, family }: Pick<Media, 'family'> & { extension?: string }) {
  const styles = preview()

  return (
    <span className={styles.file()}>
      <FileTypeIcon className={styles.fileIcon()} extension={extension} family={family} />
    </span>
  )
}

// The full name is shown, wrapped over as many lines as it needs.
function FileFooter({ className, label }: { className: string; label: string }) {
  return <span className={className}>{label}</span>
}

function Preview({
  extension,
  family,
  fit,
  kind,
  lqip,
  src,
}: Pick<Media, 'family' | 'kind' | 'lqip'> & {
  extension?: string
  fit: 'cover' | 'contain'
  src?: string
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const available = src && !failed
  const styles = preview({ fit, status: available ? 'available' : 'unavailable' })

  return (
    <span aria-hidden='true' className={styles.frame()}>
      {available ? (
        <>
          {lqip && !loaded && (
            <img
              alt=''
              className={`${styles.image()} kmg:scale-105 kmg:blur-xl`}
              decoding='async'
              src={lqip}
            />
          )}
          <img
            alt=''
            className={styles.image()}
            decoding='async'
            loading='lazy'
            onError={() => setFailed(true)}
            onLoad={() => setLoaded(true)}
            src={src}
          />
        </>
      ) : kind === 'image' ? (
        <span className={styles.message()}>Preview unavailable</span>
      ) : (
        <FileArtwork extension={extension} family={family} />
      )}
    </span>
  )
}

type Props = {
  media: Media
  layout: GalleryLayout
  href?: string
  onActivate?: () => void
  selection?: { checked: boolean; disabled: boolean; toggle: () => void }
  size?: TileSize
}

export function MediaCard({ media, href, layout, onActivate, selection, size }: Props) {
  const checkboxLabelId = useId()
  const styles = card({ layout, selected: selection?.checked, disabled: selection?.disabled })
  const ratio = layout === 'justified' ? justifiedRatio(media.ratio) : tileRatio(media.ratio)
  // Files are identified without hover, so their filename is always visible.
  const name = media.format ? `${media.label}, ${media.format}` : media.label
  const content = (
    <>
      <Preview
        extension={media.extension}
        family={media.family}
        fit={layout === 'grid' ? 'cover' : 'contain'}
        key={media.thumbnail}
        kind={media.kind}
        lqip={media.lqip}
        src={media.thumbnail}
      />
      {media.kind !== 'image' && <FileFooter className={styles.footer()} label={media.label} />}
    </>
  )

  return (
    <li
      className={styles.tile({
        class: layout === 'justified' && !size ? 'kmg:max-w-[85%]' : undefined,
      })}
      style={
        layout === 'justified'
          ? (size ?? { width: Math.min(maxTileWidth, targetHeight * ratio), aspectRatio: ratio })
          : undefined
      }
    >
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={400}
          render={
            href ? (
              <Link
                aria-label={`Edit ${name}`}
                className={styles.action()}
                href={href}
                prefetch={false}
              />
            ) : onActivate ? (
              <Button
                aria-label={`Choose ${name}`}
                className={styles.action()}
                onClick={onActivate}
                type='button'
              />
            ) : (
              <span className={styles.action()} />
            )
          }
        >
          {content}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner className='kmg:z-(--z-popup)' sideOffset={4}>
            <Tooltip.Popup className={styles.tooltip()}>{media.label}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      {selection && (
        <CheckboxInput
          checked={selection.checked}
          className={styles.checkbox()}
          id={checkboxLabelId}
          Label={
            <span className='kmg:sr-only' id={`${checkboxLabelId}-label`}>
              {selection.disabled ? `${media.label} is locked` : `Select ${media.label}`}
            </span>
          }
          name={`${checkboxLabelId}-label`}
          onToggle={selection.toggle}
          readOnly={selection.disabled}
        />
      )}
    </li>
  )
}
