export type SanityFileUrlConfig = {
  projectId: string
  dataset: string
  cdnBaseUrl?: string
}

/** Whether a Sanity asset ID is an image. */
function isSanityImageId(filename: string): boolean {
  return filename.startsWith('image-')
}

/** Whether a Sanity asset ID is a generic file. */
function isSanityFileId(filename: string): boolean {
  return filename.startsWith('file-')
}

/**
 * Build canonical Sanity CDN URL for an image or file asset.
 */
export function buildSanityAssetUrl(assetId: string, config: SanityFileUrlConfig): string {
  const { projectId, dataset, cdnBaseUrl } = config
  const baseCdn = cdnBaseUrl?.replace(/\/$/, '') ?? 'https://cdn.sanity.io'

  if (isSanityImageId(assetId)) {
    return `${baseCdn}/images/${projectId}/${dataset}/${assetId}`
  }

  if (isSanityFileId(assetId)) {
    return `${baseCdn}/files/${projectId}/${dataset}/${assetId}`
  }

  return assetId
}
