const IMAGE_EXTENSIONS = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
} as const

type ImageExtension = keyof typeof IMAGE_EXTENSIONS

export function isImageExtension(ext: string): ext is ImageExtension {
  return Object.hasOwn(IMAGE_EXTENSIONS, ext)
}

/** Provider-independent image MIME / extension classification (upload limits, asset typing). */
export function isImageFileType(mimeType?: string, filename?: string): boolean {
  if (mimeType?.startsWith('image/')) {
    return true
  }

  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext && isImageExtension(ext)) {
      return true
    }
  }

  return false
}

export function imageMimeFromExtension(ext: string): string | undefined {
  if (isImageExtension(ext)) {
    return IMAGE_EXTENSIONS[ext]
  }
  return undefined
}
