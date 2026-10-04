import type { Config, Field, GroupField } from 'payload'

import type {
  SanityStorageAltOptions,
  SanityStorageCollectionOptions,
} from '../types/adapter'

export type ResolvedCollectionAltOptions = {
  enabled: boolean
  required: boolean
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

export function localizedAltGroupField(
  locales: LocaleLike[],
  options: LocalizedAltGroupFieldOptions = {}
): GroupField {
  const required = options.required ?? false

  return {
    name: 'alt',
    type: 'group',
    label: false,
    fields: locales.map((locale) => ({
      name: locale.code,
      type: 'text' as const,
      label: locale.label ? `Alt — ${locale.label}` : `Alt — ${locale.code}`,
      required,
    })),
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
  }

  return false
}
