export type MetaIconName =
  | 'filename'
  | 'size'
  | 'dimensions'
  | 'ratio'
  | 'type'
  | 'extension'
  | 'id'
  | 'hash'
  | 'link'
  | 'path'

const paths: Record<MetaIconName, string> = {
  filename: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6',
  size: 'M4 14h16v5H4zM4 14l2.5-8h11L20 14M16.5 16.5h.01M13.5 16.5h.01',
  dimensions: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  ratio: 'M3 6h18v12H3zM8 6v12M3 12h5',
  type: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 17.5 12 22l9-4.5',
  extension: 'M8 7 3 12l5 5M16 7l5 5-5 5M14 5l-4 14',
  id: 'M4 5h16v14H4zM8 10h.01M8 14h4M14 10h3M14 14h3',
  hash: 'M5 9h14M5 15h14M10 4 8 20M16 4l-2 16',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  path: 'M3 6h6l2 2h10v11H3z',
}

/** Small stroke icon; `label` is exposed as tooltip and to assistive tech. */
export function MetaIcon({ label, name }: { label: string; name: MetaIconName }) {
  return (
    <svg
      aria-label={label}
      className='shrink-0 text-(--theme-elevation-500)'
      fill='none'
      height='16'
      role='img'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.75'
      viewBox='0 0 24 24'
      width='16'
    >
      <title>{label}</title>
      <path d={paths[name]} />
    </svg>
  )
}
