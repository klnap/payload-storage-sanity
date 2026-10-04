import type { SanityMediaDocument } from '../types/sanityStorageDocument'

export type SanityAssetKind = 'image' | 'file'

export function classifySanityAssetType(doc: SanityMediaDocument): SanityAssetKind {
  const type = doc.sanity?.type ?? ''
  if (type === 'sanity.fileAsset') return 'file'

  const mime = doc.sanity?.mimeType ?? doc.mimeType ?? ''
  if (mime.startsWith('video/')) return 'file'

  const path = doc.sanity?.path ?? ''
  if (path.startsWith('files/')) return 'file'

  const id = doc.sanity?.id ?? ''
  if (id.startsWith('file-')) return 'file'

  return 'image'
}
