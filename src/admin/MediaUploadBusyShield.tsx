'use client'

import {
  toast,
  useDocumentInfo,
  useFormFields,
  useFormProcessing,
  useUploadEdits,
} from '@payloadcms/ui'
import { useEffect, useRef } from 'react'

import {
  hasMediaBytesUpload,
  isMediaUploadBusy,
  MEDIA_UPLOAD_TOAST_ID,
  MEDIA_UPLOAD_TOAST_MESSAGE,
} from './isMediaUploadBusy'

const BUSY_ROOT_CLASS = 'sanity-media-upload-busy'

export function MediaUploadBusyShield() {
  const processing = useFormProcessing()
  const { uploadStatus } = useDocumentInfo()
  const { uploadEdits } = useUploadEdits()

  const fileValue = useFormFields(([fields]) => fields?.file?.value)

  const hasBytesUpload = hasMediaBytesUpload({
    fileValue,
    uploadEdits,
  })

  const busy = isMediaUploadBusy({
    processing,
    uploadStatus,
    hasBytesUpload,
  })

  const prevProcessing = useRef(processing)
  const prevUploadStatus = useRef(uploadStatus)

  useEffect(() => {
    const processingStarted = processing && !prevProcessing.current
    const processingEnded = !processing && prevProcessing.current
    const pasteUploadStarted =
      uploadStatus === 'uploading' && prevUploadStatus.current !== 'uploading'
    const pasteUploadEnded =
      uploadStatus !== 'uploading' && prevUploadStatus.current === 'uploading'

    if (
      (processingStarted && hasBytesUpload) ||
      (pasteUploadStarted && !processing)
    ) {
      toast.loading(MEDIA_UPLOAD_TOAST_MESSAGE, {
        id: MEDIA_UPLOAD_TOAST_ID,
        // Neutral upload styling (same as info); loading type uses a spinner instead of the info “i” glyph.
        classNames: {
          toast: 'payload-toast-item toast-info',
        },
      })
    }

    if (processingEnded || (pasteUploadEnded && !processing)) {
      toast.dismiss(MEDIA_UPLOAD_TOAST_ID)
    }

    prevProcessing.current = processing
    prevUploadStatus.current = uploadStatus
  }, [processing, uploadStatus, hasBytesUpload])

  useEffect(() => {
    const root = document.querySelector('.document-fields')
    if (!root) {
      return
    }
    if (busy) {
      root.classList.add(BUSY_ROOT_CLASS)
    } else {
      root.classList.remove(BUSY_ROOT_CLASS)
    }
    return () => {
      root.classList.remove(BUSY_ROOT_CLASS)
    }
  }, [busy])

  useEffect(() => {
    const id = 'sanity-media-upload-busy-style'
    if (document.getElementById(id)) {
      return
    }
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
.${BUSY_ROOT_CLASS} .document-fields__main {
  pointer-events: none;
}
`
    document.head.appendChild(style)
  }, [])

  return null
}
