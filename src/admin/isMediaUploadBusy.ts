import type { UploadEdits } from 'payload'

import { uploadEditsRequireBytesReupload } from '../utils/uploadEdits'

export const MEDIA_UPLOAD_TOAST_ID = 'payload-sanity-media-upload'

export const MEDIA_UPLOAD_TOAST_MESSAGE = 'Uploading…'

export type MediaUploadBusyUploadStatus = 'failed' | 'idle' | 'uploading' | undefined

/** True when this save will send bytes to storage (new/replaced file or crop/resize reprocess). */
export function hasMediaBytesUpload(args: {
  fileValue: unknown
  uploadEdits?: UploadEdits
  docWidth?: number | null
  docHeight?: number | null
}): boolean {
  if (args.fileValue instanceof File) {
    return true
  }

  const edits = args.uploadEdits
  if (!edits || typeof edits !== 'object') {
    return false
  }

  return uploadEditsRequireBytesReupload(edits, {
    docWidth: args.docWidth,
    docHeight: args.docHeight,
  })
}

export function isMediaUploadBusy(args: {
  processing: boolean
  uploadStatus?: MediaUploadBusyUploadStatus
  hasBytesUpload: boolean
}): boolean {
  if (args.uploadStatus === 'uploading') {
    return true
  }

  if (!args.processing) {
    return false
  }

  return args.hasBytesUpload
}
