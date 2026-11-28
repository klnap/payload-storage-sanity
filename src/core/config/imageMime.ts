import { classifyMedia } from './mediaClassification'

/** Provider-independent image MIME / extension classification (upload limits, asset typing). */
export function isImageFileType(mimeType?: string, filename?: string): boolean {
  return classifyMedia({ mimeType, filename }).mediaType === 'image'
}

export function imageMimeFromExtension(ext: string): string | undefined {
  const classification = classifyMedia({ filename: `file.${ext}` })
  return classification.mediaType === 'image' ? classification.mimeType : undefined
}
