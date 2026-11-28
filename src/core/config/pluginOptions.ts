import type { ClientConfig } from '@sanity/client'
import type { UploadCollectionSlug } from 'payload'
import type { SanityStorageMode } from './storageMode'
import type { SanitySyncAccessFn } from './syncAccess'
import type { SanityStorageUploadMaxSizeInput } from './uploadMaxSizeTypes'
import type { SanityMediaFolderOption, SanityMediaFolders } from './mediaFolders'

export type SanityStorageSyncWebhookConfig = {
  secret: string
  path?: string
  collection?: string
  /**
   * Maximum raw webhook request body size in **bytes** (UTF-8 JSON).
   * Enforced in the webhook handler (Content-Length early reject + bounded read).
   * @default 262144 (256 KiB)
   *
   * Hosts / reverse proxies may impose a lower limit independently; raise those
   * separately when increasing this value. Does not change multipart upload limits.
   */
  maxBodySizeBytes?: number
}

export type SanityStorageSyncReconcileConfig = {
  path?: string
  collection?: string
}

export type SanityStorageSyncConfig = {
  enabled?: boolean
  /**
   * Base path for sync routes under `/api` (webhook + reconcile).
   * @default '/sanity-storage'
   */
  basePath?: string
  webhook?: SanityStorageSyncWebhookConfig
  reconcile?: SanityStorageSyncReconcileConfig | false
  onDeleted?: 'mark' | 'delete'
  /**
   * Who may call batch reconcile (`POST /api/sanity-storage/reconcile` by default).
   * @default admin auth collection only (`req.user.collection === config.admin.user`)
   */
  access?: SanitySyncAccessFn
}

export type SanityStorageAdminOptions = {
  /**
   * During Save/upload: neutral “Uploading…” toast and non-interactive field area (preview stays visible).
   * Success uses Payload’s standard admin toast only.
   * @default true
   */
  uploadBusyShield?: boolean
  /**
   * Replaces the list view with a justified/grid media gallery. Skipped when the collection
   * already has its own list view component.
   * @default true
   */
  gallery?: boolean
}

export type SanityStorageAltOptions = {
  /**
   * Inject localized `alt` group on configured upload collections.
   * @default true
   */
  enabled?: boolean
  /**
   * Require every locale subfield in the injected alt group (or the plain `alt` field
   * when Payload has no localization). Empty values fail validation.
   * @default false
   */
  required?: boolean
}

export type SanityStoragePopulateConfig = {
  /** @default 'default' */
  preset?: 'default' | 'full'
  /**
   * Apply preset `default` on Local API (`find` / `findGlobal`) as well as REST nested populate.
   * Direct `GET /api/media/:id` still returns the full document for the admin editor.
   * @default true when preset is `default`
   */
  localPopulate?: boolean
}

export type {
  SanityStorageUploadMaxSizeConfig,
  SanityStorageUploadMaxSizeInput,
} from './uploadMaxSizeTypes'

export type SanityStorageCollectionOptions = {
  /**
   * `false` excludes the collection: no Sanity storage, fields, hooks, endpoints or admin changes.
   * @default true
   */
  enabled?: boolean
  /** Per-collection admin UX overrides (merged with plugin-level `admin`). */
  admin?: SanityStorageAdminOptions
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
   * Max upload size in bytes (`default` + optional `byType`). Merged with plugin-level `uploadMaxSize`; collection fields win per key.
   */
  uploadMaxSize?: SanityStorageUploadMaxSizeInput
  /**
   * Logical folder path for `sanity-plugin-media` (not a Media Library directory).
   * @default 'Payload'
   */
  folder?: SanityMediaFolderOption
}

/**
 * HTTP upload transport following the versioned Sanity upload ticket protocol.
 * The endpoint receives a signed ticket and raw file bytes. Keep `secret`
 * private to Payload and the trusted transport implementation.
 */
export type UploadTransport = {
  endpoint: string
  maxSizeBytes: number
  protocolVersion: 1
  secret: string
}

export type SanityStorageUploadConfig = {
  /** Optional direct-to-transport upload. Internal Sanity upload remains the default. */
  transport?: UploadTransport
}

export type SanityStoragePluginOptions = {
  /** Default admin UX for all configured upload collections (overridable per collection). */
  admin?: SanityStorageAdminOptions
  projectId: string
  dataset: string
  token?: string
  apiVersion?: string
  /** Custom Sanity HTTP transport, for testing or network proxy configuration. */
  resolveFetch?: ClientConfig['resolveFetch']
  cdnBaseUrl?: string
  /**
   * `full` — Sanity uploads + adapter (default).
   * `fields-only` — inject Sanity fields without the storage adapter.
   * `off` — skip cloud-storage registration; collection hooks/endpoints still apply when configured.
   */
  mode?: SanityStorageMode
  /**
   * Upload collections to enable. Omit to discover eligible upload collections automatically.
   * `true` and `{}` enable with defaults; `false` or `enabled: false` exclude the collection.
   */
  collections?: Partial<Record<UploadCollectionSlug, boolean | SanityStorageCollectionOptions>>
  populate?: SanityStoragePopulateConfig
  sync?: SanityStorageSyncConfig
  /** SHA-1 deduplication on create (`mode: 'full'` only). Default `false` — set `dedupeUploads: true` to opt in. */
  dedupeUploads?: boolean
  preventDeleteWhenReferenced?: boolean
  /**
   * Max upload size in bytes for configured media collections (`default` + optional `byType` overrides).
   */
  uploadMaxSize?: SanityStorageUploadMaxSizeInput
  /** Logical Sanity folders by classified media type. Set `false` to disable folder assignment. */
  folders?: false | SanityMediaFolders
  upload?: SanityStorageUploadConfig
}
