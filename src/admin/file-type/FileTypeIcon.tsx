import type { MediaFamily } from '../gallery/media'

const palette: Record<MediaFamily, string> = {
  image: '#0091ff',
  video: '#12a594',
  audio: '#d6409f',
  pdf: '#e5484d',
  document: '#3e63dd',
  sheet: '#30a46c',
  slides: '#f76b15',
  text: '#6f7c8a',
  code: '#8e4ec6',
  archive: '#d9a100',
  file: '#6f7c8a',
}

const fallbackLabel: Record<MediaFamily, string> = {
  image: 'IMG',
  video: 'VID',
  audio: 'AUD',
  pdf: 'PDF',
  document: 'DOC',
  sheet: 'XLS',
  slides: 'PPT',
  text: 'TXT',
  code: 'CODE',
  archive: 'ZIP',
  file: 'FILE',
}

function Glyph({ family }: { family: MediaFamily }) {
  const stroke = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const }
  switch (family) {
    case 'video':
      return <path d='m20 15 8 4.5-8 4.5v-9Z' fill='currentColor' />
    case 'audio':
      return (
        <path
          d='M19 25v-8l9-2v8m-9 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm9-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'
          fill='none'
          {...stroke}
        />
      )
    case 'archive':
      return <path d='M24 12v3m0 3v3m0 3v3' fill='none' {...stroke} />
    case 'sheet':
      return <path d='M16 14h16v13H16Zm0 4.3h16m0 4.4H16M24 14v13' fill='none' {...stroke} />
    case 'slides':
      return <path d='M16 15h16v10H16Zm8 10v3m-4 0h8' fill='none' {...stroke} />
    case 'code':
      return <path d='m21 16-4 5 4 5m6-10 4 5-4 5' fill='none' {...stroke} />
    case 'pdf':
      return (
        <path
          d='M17 25c4-3 5-8 4-9-1.4-1 .4 5 5 8 2 1 4 .5 4-.5s-5-1.5-9 1.5'
          fill='none'
          {...stroke}
        />
      )
    default:
      return <path d='M17 16h14M17 21h14M17 26h9' fill='none' {...stroke} />
  }
}

/** Recognisable file-type icon: family colour, glyph and the extension on a badge. */
export function FileTypeIcon({
  extension,
  family,
  className,
  size,
}: {
  extension?: string
  family: MediaFamily
  className?: string
  size?: number
}) {
  const color = palette[family]
  const label = (extension || fallbackLabel[family]).toUpperCase().slice(0, 4)

  return (
    <svg
      aria-hidden='true'
      className={className}
      fill='none'
      height={size}
      style={{ color }}
      viewBox='0 0 48 48'
      width={size}
    >
      <path
        d='M10 6.5A2.5 2.5 0 0 1 12.5 4H29l9 9v29.5a2.5 2.5 0 0 1-2.5 2.5h-23a2.5 2.5 0 0 1-2.5-2.5v-36Z'
        fill='var(--theme-elevation-50)'
        stroke='currentColor'
        strokeWidth='1.5'
      />
      <path d='M29 4v9h9' stroke='currentColor' strokeWidth='1.5' />
      <Glyph family={family} />
      <rect
        fill='currentColor'
        height='9'
        rx='2'
        width={Math.max(22, label.length * 6 + 8)}
        x={(48 - Math.max(22, label.length * 6 + 8)) / 2}
        y='30'
      />
      <text
        fill='#fff'
        fontFamily='system-ui, sans-serif'
        fontSize='7'
        fontWeight='700'
        textAnchor='middle'
        x='24'
        y='36.5'
      >
        {label}
      </text>
    </svg>
  )
}
