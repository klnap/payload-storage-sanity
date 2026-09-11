import type { Field } from 'payload'

export type SanityStorageSyncConfig = {
  enabled?: boolean
  webhookSecret?: string
  webhookPath?: string
  webhookCollection?: string
  onDeleted?: 'mark' | 'delete'
  reconcile?: boolean
  reconcilePath?: string
  reconcileCollection?: string
}

export type SanityStorageCollectionOptions = {
  disableLocalStorage?: boolean
  prefix?: string
  disablePayloadAccessControl?: boolean
}

export type SanityStoragePluginOptions = {
  projectId: string
  dataset: string
  token?: string
  apiVersion?: string
  cdnBaseUrl?: string
  enabled?: boolean
  alwaysInsertFields?: boolean
  collections: Record<string, true | SanityStorageCollectionOptions>
  sync?: SanityStorageSyncConfig
  dedupeUploads?: boolean
  extraFields?: Field[]
}
