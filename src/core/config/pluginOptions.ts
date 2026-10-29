import type { Field } from 'payload'
import type { SanityStorageMode } from './storageMode'
import type { SanitySyncAccessFn } from './syncAccess'
import type { SanityStorageUploadMaxSizeInput } from './uploadMaxSizeTypes'

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
  /**
   * When the request locale has no alt value, try this locale key in the localized group.
   * Does not apply to plain string `alt` fields.
   */
  fallbackLocale?: string
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
  SanityStorageUploadMaxSizeByType,
  SanityStorageUploadMaxSizeConfig,
  SanityStorageUploadMaxSizeInput,
} from './uploadMaxSizeTypes'

export type SanityStorageCollectionOptions = {
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
}

export type SanityStoragePluginOptions = {
  /** Default admin UX for all configured upload collections (overridable per collection). */
  admin?: SanityStorageAdminOptions
  projectId: string
  dataset: string
  token?: string
  apiVersion?: string
  cdnBaseUrl?: string
  /**
   * `full` — Sanity uploads + adapter (default).
   * `fields-only` — inject Sanity fields without the storage adapter.
   * `off` — skip cloud-storage registration; collection hooks/endpoints still apply when configured.
   */
  mode?: SanityStorageMode
  collections: Record<string, true | SanityStorageCollectionOptions>
  populate?: SanityStoragePopulateConfig
  sync?: SanityStorageSyncConfig
  /** SHA-1 deduplication on create (`mode: 'full'` only). Default `false` — set `dedupeUploads: true` to opt in. */
  dedupeUploads?: boolean
  preventDeleteWhenReferenced?: boolean
  extraFields?: Field[]
  /**
   * Max upload size in bytes for configured media collections (`default` + optional `byType` overrides).
   */
  uploadMaxSize?: SanityStorageUploadMaxSizeInput
}
