import type { Config, Field, GroupField, RowField } from 'payload'
import type { SanityStorageAltOptions, SanityStorageCollectionOptions } from '@/core/config'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'

export type ResolvedCollectionAltOptions = {
  enabled: boolean
  required: boolean
  fallbackLocale?: string
}

export function resolveCollectionAltOptions(
  collOptions: true | SanityStorageCollectionOptions
): ResolvedCollectionAltOptions {
  if (collOptions === true) {
    return { enabled: true, required: false }
  }

  const alt: SanityStorageAltOptions | undefined = collOptions.alt

  return {
    enabled: alt?.enabled ?? true,
    required: alt?.required ?? false,
    fallbackLocale: alt?.fallbackLocale,
  }
}

export type PlainAltTextFieldOptions = {
  /** @default false */
  required?: boolean
}

/** Single-locale `alt` text field when Payload has no `localization.locales`. */
export function plainAltTextField(options: PlainAltTextFieldOptions = {}): Field {
  const required = options.required ?? false

  return {
    name: 'alt',
    type: 'text',
    label: SANITY_STORAGE_I18N_KEYS.fieldAltTextLabel,
    required,
  }
}

export type LocaleLike = {
  code: string
  label?: string
}

export type LocalizedAltGroupFieldOptions = {
  /** @default false */
  required?: boolean
}

function localizedAltGroupInner(
  locales: LocaleLike[],
  options: LocalizedAltGroupFieldOptions = {}
): GroupField {
  const required = options.required ?? false

  return {
    name: 'alt',
    type: 'group',
    label: false,
    admin: {
      // Inside a row → Payload applies `group-field--within-row` (no top/bottom rules)
      hideGutter: true,
      className: 'pss-media-alt',
      style: {
        border: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
      },
    },
    fields: locales.map((locale) => ({
      name: locale.code,
      type: 'text' as const,
      label: ({ t }) =>
        sanityStorageTranslate(
          t as SanityStorageTranslateFn,
          SANITY_STORAGE_I18N_KEYS.fieldAltLocaleLabel,
          {
            locale: locale.label ?? locale.code,
          }
        ),
      required,
    })),
  }
}

/**
 * Localized alt fields without the tab-level `group-field` top border.
 * Wrapped in a `row` so Payload marks the group `--within-row` (borders off).
 * Paths stay `alt.<locale>` — same persistence shape as a bare group.
 */
export function localizedAltGroupField(
  locales: LocaleLike[],
  options: LocalizedAltGroupFieldOptions = {}
): RowField {
  return {
    type: 'row',
    admin: {
      className: 'pss-media-alt-row',
    },
    fields: [localizedAltGroupInner(locales, options)],
  }
}

function normalizeLocaleEntry(entry: unknown): LocaleLike | null {
  if (entry == null || typeof entry !== 'object') {
    return null
  }

  if ('code' in entry && typeof (entry as { code: unknown }).code === 'string') {
    const { code, label } = entry as { code: string; label?: unknown }
    return {
      code,
      label: typeof label === 'string' ? label : undefined,
    }
  }

  return null
}

/** Read locale codes from Payload config `localization` for alt group generation. */
export function getLocalizationLocales(config: Config): LocaleLike[] {
  const localization = config.localization

  if (localization == null || localization === false) {
    return []
  }

  const rawLocales = Array.isArray(localization)
    ? localization
    : typeof localization === 'object' && 'locales' in localization
      ? localization.locales
      : undefined

  if (!Array.isArray(rawLocales)) {
    return []
  }

  const result: LocaleLike[] = []
  for (const entry of rawLocales) {
    const normalized = normalizeLocaleEntry(entry)
    if (normalized) {
      result.push(normalized)
    }
  }

  return result
}

export function collectionHasAltField(fields: Field[] | undefined): boolean {
  if (!fields?.length) {
    return false
  }

  for (const field of fields) {
    if ('name' in field && field.name === 'alt') {
      return true
    }
    if (field.type === 'row' && 'fields' in field && Array.isArray(field.fields)) {
      if (collectionHasAltField(field.fields)) return true
    }
  }

  return false
}
