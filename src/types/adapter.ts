import type { Field } from 'payload'

import type { SanityMediaPopulatePresetRegistry } from '../populate/presets'

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

export type SanityStorageAltOptions = {
  /**
   * Inject localized `alt` group on configured upload collections.
   * @default true
   */
  enabled?: boolean
  /**
   * Require every locale subfield in the injected alt group.
   * @default false
   */
  required?: boolean
}

export type SanityStoragePopulateConfig = {
  /** @default 'full' */
  preset?: 'default' | 'full' | string
  presets?: SanityMediaPopulatePresetRegistry
  /** When Payload does not expose populate context, allow forcing default populate on all afterRead (debug). */
  defaultPopulateOnRead?: boolean
}

export type SanityStorageCollectionOptions = {
  /**
   * Localized alt group (`alt.pl`, `alt.en`, …). Skipped if the collection already defines `alt`.
   * Defaults: `enabled: true`, `required: false` (including `collections.media: true` shorthand).
   */
  alt?: SanityStorageAltOptions
  disableLocalStorage?: boolean
  prefix?: string
  disablePayloadAccessControl?: boolean
  preventDeleteWhenReferenced?: boolean
  populate?: SanityStoragePopulateConfig
  /**
   * Stable CDN thumbnail preview in admin (fixed box + shimmer). Disables Payload upload `displayPreview` and uses plugin preview field.
   * @default true
   */
  stableAdminThumbnail?: boolean
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
  populate?: SanityStoragePopulateConfig
  sync?: SanityStorageSyncConfig
  dedupeUploads?: boolean
  preventDeleteWhenReferenced?: boolean
  extraFields?: Field[]
}
