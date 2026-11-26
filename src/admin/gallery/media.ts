import { getSanityLqip } from './lqip'

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:\.[\w-]+)?$/i
const mimeKind = /^(image|video|audio)\/[a-z0-9][a-z0-9.+-]*$/i
type MediaKind = 'image' | 'video' | 'audio' | 'file'
export type MediaFamily =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'sheet'
  | 'slides'
  | 'text'
  | 'code'
  | 'archive'
  | 'file'

// MIME type is the primary signal; the extension decides only when the MIME type is unknown.
const mimeFamilies: Record<string, MediaFamily> = {
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/rtf': 'document',
  'text/rtf': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/vnd.ms-excel': 'sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'sheet',
  'text/csv': 'sheet',
  'application/vnd.ms-powerpoint': 'slides',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slides',
  'application/vnd.oasis.opendocument.presentation': 'slides',
  'text/plain': 'text',
  'text/markdown': 'text',
  'application/json': 'code',
  'application/xml': 'code',
  'text/xml': 'code',
  'text/html': 'code',
  'text/css': 'code',
  'text/javascript': 'code',
  'application/javascript': 'code',
  'application/typescript': 'code',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/vnd.rar': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  'application/x-gzip': 'archive',
  'application/x-7z-compressed': 'archive',
}

const extensionFamilies: Record<string, MediaFamily> = {
  pdf: 'pdf',
  doc: 'document',
  docx: 'document',
  odt: 'document',
  rtf: 'document',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  ods: 'sheet',
  ppt: 'slides',
  pptx: 'slides',
  odp: 'slides',
  txt: 'text',
  md: 'text',
  json: 'code',
  xml: 'code',
  html: 'code',
  css: 'code',
  js: 'code',
  ts: 'code',
  zip: 'archive',
  rar: 'archive',
  tar: 'archive',
  gz: 'archive',
  '7z': 'archive',
}

const familyFormats: Record<MediaFamily, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  document: 'Document',
  sheet: 'Spreadsheet',
  slides: 'Presentation',
  text: 'Text',
  code: 'Code',
  archive: 'Archive',
  file: 'File',
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function altText(value: unknown, locale: string | undefined) {
  if (typeof value === 'string') return text(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  if (locale && locale in value) {
    return text(Reflect.get(value, locale))
  }
  return ''
}

function mediaURL(value: unknown) {
  const url = text(value)
  if (!url || /[\p{Cc}\\]/u.test(url)) return undefined
  if (url.startsWith('/') && !url.startsWith('//')) return url
  if (!/^https?:\/\//i.test(url)) return undefined
  try {
    const parsed = new URL(url)
    return !parsed.username && !parsed.password ? url : undefined
  } catch {
    return undefined
  }
}

function lqipURL(doc: Record<string, unknown>, imageURL?: string) {
  const value = text(doc.lqip) || getSanityLqip(doc)

  if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(value)) return value

  const thumbnail = mediaURL(imageURL)
  if (!thumbnail) return undefined

  try {
    const url = new URL(thumbnail)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'cdn.sanity.io' ||
      !url.pathname.startsWith('/images/')
    ) {
      return undefined
    }

    url.searchParams.delete('w')
    url.searchParams.delete('h')
    url.searchParams.delete('q')
    url.searchParams.delete('blur')
    url.searchParams.set('w', '24')
    url.searchParams.set('q', '20')
    url.searchParams.set('blur', '40')
    return url.toString()
  } catch {
    return undefined
  }
}

function fileExtension(filename: string) {
  return filename.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase()
}

function fileFamily(filename: string, mime: string): MediaFamily {
  const extension = fileExtension(filename)
  const byMime = mimeFamilies[mime]
  const byExtension = extension ? extensionFamilies[extension] : undefined
  // Office files are ZIP containers, so detectors often report them as archives.
  if (byMime === 'archive' && byExtension && byExtension !== 'archive') return byExtension
  return byMime ?? byExtension ?? 'file'
}

function fileSize(bytes: unknown) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return undefined
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit && value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

// Storage adapters keep the uploaded name on the provider asset, not always on `filename`.
function sanityOriginalFilename(doc: Record<string, unknown>) {
  const sanity = doc.sanity
  const asset = sanity && typeof sanity === 'object' ? Reflect.get(sanity, 'asset') : undefined
  return asset && typeof asset === 'object' ? text(Reflect.get(asset, 'originalFilename')) : ''
}

function urlFilename(url: string | undefined) {
  const last = (url ?? '').split(/[?#]/, 1)[0]?.split('/').pop() ?? ''
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

export function presentMedia(doc: Record<string, unknown>, locale?: string) {
  const filename = text(doc.filename)
  const originalName = sanityOriginalFilename(doc)
  const alt = altText(doc.alt, locale)
  const thumbnail = mediaURL(doc.thumbnailURL)
  const original = mediaURL(doc.url)
  const mime = text(doc.mimeType).toLowerCase()
  const candidate = `${filename} ${original?.split(/[?#]/, 1)[0] ?? ''}`
  const inferredKind = inferKind(candidate, thumbnail, original)
  const match = mime.match(mimeKind)?.[1]
  const kind: MediaKind =
    match === 'image' || match === 'video' || match === 'audio'
      ? match
      : /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime) && mime !== 'application/octet-stream'
        ? 'file'
        : inferredKind
  const family: MediaFamily = kind === 'file' ? fileFamily(filename || originalName, mime) : kind
  const ratio =
    typeof doc.width === 'number' &&
    typeof doc.height === 'number' &&
    Number.isFinite(doc.width) &&
    Number.isFinite(doc.height) &&
    doc.width > 0 &&
    doc.height > 0
      ? doc.width / doc.height
      : // Documents are portrait by convention; this is a layout hint, not file metadata.
        kind === 'file'
        ? 3 / 4
        : 4 / 3
  // Title first, then the original filename, so identical files stay distinguishable; UUIDs never become labels.
  const name = [
    text(doc.title),
    originalName,
    filename,
    text(doc.name),
    alt,
    urlFilename(original),
  ].find((value) => value && !uuid.test(value))
  const isSVG = mime === 'image/svg+xml' || /\.svg(?:\s|$)/i.test(candidate)
  const lqip = kind === 'image' && !isSVG ? lqipURL(doc, thumbnail ?? original) : undefined
  const size = kind === 'image' ? undefined : fileSize(doc.filesize)
  const extension = fileExtension(filename || originalName || urlFilename(original))

  return {
    kind,
    family,
    label: name || (kind === 'file' ? 'Untitled file' : `Untitled ${kind}`),
    ...(kind !== 'image' ? { format: familyFormats[family] } : {}),
    ...(extension ? { extension } : {}),
    ...(originalName ? { originalName } : {}),
    ...(size ? { size } : {}),
    ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 4 / 3,
    thumbnail: kind === 'image' ? (thumbnail ?? original) : undefined,
    ...(lqip ? { lqip } : {}),
  }
}

function inferKind(candidate: string, thumbnail?: string, original?: string): MediaKind {
  if (/\.(avif|gif|jpe?g|png|svg|webp)(?:\s|$)/i.test(candidate)) return 'image'
  if (/\.(m4v|mov|mp4|ogv|webm)(?:\s|$)/i.test(candidate)) return 'video'
  if (/\.(aac|flac|m4a|mp3|oga|ogg|wav)(?:\s|$)/i.test(candidate)) return 'audio'
  return thumbnail && thumbnail !== original ? 'image' : 'file'
}
