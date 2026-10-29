import { PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE } from './constants'

const strings = {
  uploadBusy: 'Uploading…',
  usageType: 'Type',
  usageStatus: 'Status',
  usageDocument: 'Document',
  usageField: 'Field',
  usageSearch: 'Search by Type, Status, Document, or Field',
  usageSortByTypeAscending: 'Sort by Type Ascending',
  usageSortByTypeDescending: 'Sort by Type Descending',
  usageSortByStatusAscending: 'Sort by Status Ascending',
  usageSortByStatusDescending: 'Sort by Status Descending',
  usageSortByDocumentAscending: 'Sort by Document Ascending',
  usageSortByDocumentDescending: 'Sort by Document Descending',
  usageSortByFieldAscending: 'Sort by Field Ascending',
  usageSortByFieldDescending: 'Sort by Field Descending',
  usagePublished: 'Published',
  usageDraft: 'Draft',
  usageGlobal: 'Global',
  usageCollection: 'Collection',
  usageNotReferenced: 'This asset is not referenced by any documents yet.',
  recoveryDeleted:
    'This asset was deleted upstream. Replace it with a new upload or unlink the reference.',
  recoveryError:
    'Could not verify this asset. Replace it with a new upload or unlink the reference.',
  recoveryMissing:
    'This asset is missing or unavailable. Replace it with a new upload or unlink the reference.',
  recoveryUnavailable:
    'This media reference is unavailable. Replace it with a new upload or unlink the reference.',
  mediaDeleteVerifyFailed: 'Could not verify whether this media asset is still referenced.',
  mediaDeleteCompact: '{{mediaLabel}}: in use ({{count}} {{noun}})',
  mediaDeleteBlock:
    'Cannot delete media asset because it is currently referenced by {{count}} {{noun}}.',
  mediaDeleteBlockGeneric:
    'Cannot delete media asset because it is currently referenced by other documents.',
  mediaUsageDocument: 'document',
  mediaUsageDocuments: 'documents',
  uploadKindImage: 'Image',
  uploadKindVideo: 'Video',
  uploadKindFile: 'File',
  uploadMaxSizeExceeded: '{{kindLabel}} is {{actualSize}}; maximum allowed is {{limitSize}}.',
  uploadDuplicateCompact: '{{filename}}: already in library (ID {{existingId}})',
  uploadDuplicateBlock:
    'This file is already in your media library (ID {{existingId}}). Open the existing asset instead of uploading again.',
  sanityNotConfiguredForUpload: 'Sanity storage is not configured for uploads.',
  sanityUploadFailed: 'Sanity asset upload failed.',
  recoveryReplace: 'Replace',
  recoveryUnlink: 'Unlink',
  recoveryMediaId: '(ID: {{id}})',
  fieldOriginalFilenameLabel: 'Original Filename',
  fieldOriginalFilenameDescription: 'Original name of the uploaded file.',
  fieldMediaNameLabel: 'Name',
  fieldMediaNameDescription: 'Internal name used for identification.',
  fieldSyncStatusLabel: 'Status',
  fieldSyncStatusDescription: 'Current status of the asset.',
  fieldSyncCheckedAtLabel: 'Checked At',
  fieldSyncCheckedAtDescription: 'Timestamp when the asset was last verified.',
  fieldSyncLastErrorLabel: 'Last Error',
  fieldSyncLastErrorDescription: 'Details of the latest synchronization issue if one occurred.',
  fieldAltTextLabel: 'Alt text',
  fieldAltLocaleLabel: 'Alt — {{locale}}',
  apiUnauthorized: 'Unauthorized',
  apiMissingMediaId: 'Missing media id',
  apiNotFound: 'Not found',
  apiForbidden: 'Forbidden',
  apiMediaUsageFailed: 'Failed to find media usage',
  apiReconcileFailed: 'Reconcile failed',
  apiWebhookEmptyBody: 'Empty webhook body',
  apiWebhookInvalidPayload: 'Invalid webhook JSON payload',
  apiWebhookProcessingFailed: 'Webhook processing failed',
}

export const sanityStoragePluginTranslations = {
  en: {
    [PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]: strings,
  },
}
