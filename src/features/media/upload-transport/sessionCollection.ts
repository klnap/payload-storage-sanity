import type { CollectionConfig } from 'payload'

export const SANITY_UPLOAD_SESSION_COLLECTION = 'sanity-upload-sessions'
export const SANITY_UPLOAD_FINALIZATION_SUFFIX = ':finalized'

/** Durable unique IDs make concurrent claims and finalization races database-enforced. */
export const sanityUploadSessionCollection: CollectionConfig = {
  slug: SANITY_UPLOAD_SESSION_COLLECTION,
  admin: { hidden: true },
  access: {
    create: () => false,
    delete: () => false,
    read: () => false,
    update: () => false,
  },
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'kind', type: 'select', options: ['claim', 'finalization'], required: true },
    { name: 'nonce', type: 'text', required: true, index: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'collection', type: 'text', required: true },
    { name: 'operation', type: 'select', options: ['create', 'update'], required: true },
    { name: 'documentId', type: 'text' },
    { name: 'projectId', type: 'text', required: true },
    { name: 'dataset', type: 'text', required: true },
    { name: 'audience', type: 'text', required: true },
    { name: 'filename', type: 'text', required: true },
    { name: 'mimeType', type: 'text', required: true },
    { name: 'size', type: 'number', required: true },
    { name: 'maxSize', type: 'number', required: true },
    { name: 'issuedAt', type: 'number', required: true },
    { name: 'expiresAt', type: 'number', required: true },
    { name: 'assetId', type: 'text' },
    { name: 'result', type: 'json' },
  ],
}
