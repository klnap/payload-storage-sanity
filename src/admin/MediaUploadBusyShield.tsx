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
import { resolveUploadToastAction } from './uploadToastSync'

const BUSY_ROOT_CLASS = 'sanity-media-upload-busy'

export function MediaUploadBusyShield() {
  const processing = useFormProcessing()
  const { collectionSlug, uploadStatus } = useDocumentInfo()
  const { uploadEdits } = useUploadEdits()

  const toastEnabled = Boolean(collectionSlug)

  const { fileValue, docWidth, docHeight } = useFormFields(([fields]) => ({
    fileValue: fields?.file?.value,
    docWidth: fields?.width?.value as number | undefined,
    docHeight: fields?.height?.value as number | undefined,
  }))

  const hasBytesUpload = hasMediaBytesUpload({
    fileValue,
    uploadEdits,
    docWidth,
    docHeight,
  })

  const busy = isMediaUploadBusy({
    processing,
    uploadStatus,
    hasBytesUpload,
  })

  const prevBusy = useRef(false)

  useEffect(() => {
    const action = resolveUploadToastAction({
      busy,
      prevBusy: prevBusy.current,
      enabled: toastEnabled,
    })

    if (action === 'show') {
      toast.loading(MEDIA_UPLOAD_TOAST_MESSAGE, {
        id: MEDIA_UPLOAD_TOAST_ID,
        classNames: {
          toast: 'payload-toast-item toast-info',
        },
      })
    } else if (action === 'dismiss') {
      toast.dismiss(MEDIA_UPLOAD_TOAST_ID)
    }

    prevBusy.current = busy
  }, [busy, toastEnabled])

  useEffect(() => {
    return () => {
      toast.dismiss(MEDIA_UPLOAD_TOAST_ID)
    }
  }, [])

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
