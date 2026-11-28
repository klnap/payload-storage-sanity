import type { MediaType } from './mediaClassification'
import { parseSanityAssetFolderPath } from './sanityFolderPath'

export type SanityMediaFolderKey = MediaType
export type SanityMediaFolders = Partial<Record<SanityMediaFolderKey, string | false>>
export type SanityMediaFolderOption = false | string | SanityMediaFolders

const DEFAULT_FOLDERS: Record<MediaType, string> = {
  image: 'Payload/images',
  video: 'Payload/videos',
  audio: 'Payload/audio',
  file: 'Payload/files',
}

function validateFolderOption(option: unknown): void {
  if (option === undefined || option === false) return
  if (typeof option === 'string') {
    parseSanityAssetFolderPath(option)
    return
  }
  if (option == null || typeof option !== 'object' || Array.isArray(option)) {
    throw new Error('Folder configuration must be false, a path, or a media-type map.')
  }
  for (const [key, value] of Object.entries(option)) {
    if (!['image', 'video', 'audio', 'file'].includes(key)) {
      throw new Error(`Unknown folder category "${key}".`)
    }
    if (value !== false) parseSanityAssetFolderPath(value)
  }
}

export function validateSanityMediaFolderOption(option: unknown): void {
  validateFolderOption(option)
}

/** Resolves collection, global, then default folder policy without moving existing assets. */
export function resolveSanityMediaFolder(
  mediaType: MediaType,
  collectionOption?: SanityMediaFolderOption,
  globalOption?: false | SanityMediaFolders
): string | false {
  if (collectionOption === false) return false
  if (globalOption === false) return false
  if (typeof collectionOption === 'string') return collectionOption

  const collectionTypeValue =
    typeof collectionOption === 'object' ? collectionOption[mediaType] : undefined
  if (collectionTypeValue === false) return false
  if (typeof collectionTypeValue === 'string') return collectionTypeValue

  const globalTypeValue = globalOption?.[mediaType]
  if (globalTypeValue === false) return false
  if (typeof globalTypeValue === 'string') return globalTypeValue

  return DEFAULT_FOLDERS[mediaType]
}
