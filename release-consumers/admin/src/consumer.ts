import {
  hasMediaBytesUpload,
  isMediaUploadBusy,
  MEDIA_METADATA_INSPECTOR_IMPORT,
  MEDIA_REFERENCES_INSPECTOR_IMPORT,
  MEDIA_USAGE_INSPECTOR_IMPORT,
  MediaMetadataInspector,
  MediaReferences,
  MediaUsageInspector,
} from '@klnap/payload-storage-sanity/admin'

const busy = isMediaUploadBusy({
  processing: false,
  hasBytesUpload: false,
})

const bytes = hasMediaBytesUpload({ fileValue: null })

export const inspectorComponent = MediaUsageInspector
export const metadataInspectorComponent = MediaMetadataInspector
export const referencesComponent = MediaReferences
export const usageInspectorImport = MEDIA_USAGE_INSPECTOR_IMPORT
export const metadataInspectorImport = MEDIA_METADATA_INSPECTOR_IMPORT
export const referencesInspectorImport = MEDIA_REFERENCES_INSPECTOR_IMPORT
export const sampleBusy = busy || bytes
