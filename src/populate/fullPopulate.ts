import type { CollectionConfig } from 'payload'

import { sanityMediaDefaultPopulateSelect } from './mediaDefaultPopulateSelect'

export type PopulateSelect = NonNullable<CollectionConfig['defaultPopulate']>

export type PopulateOptions = {
  extend?: PopulateSelect
  exclude?: string[]
}

export type PopulateFn = (overrides?: PopulateOptions) => PopulateSelect

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function deepMergeSelect(base: PopulateSelect, patch: PopulateSelect): PopulateSelect {
  const out: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(patch)) {
    if (value === true) {
      out[key] = true
      continue
    }
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMergeSelect(out[key] as PopulateSelect, value as PopulateSelect)
      continue
    }
    out[key] = value
  }

  return out as PopulateSelect
}

function deleteAtPath(target: Record<string, unknown>, path: string): void {
  const parts = path.split('.')
  let node: Record<string, unknown> = target

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const next = node[part]
    if (!isPlainObject(next)) {
      return
    }
    node = next
  }

  delete node[parts[parts.length - 1]]
}

function applyExcludes(select: PopulateSelect, exclude: string[]): PopulateSelect {
  if (exclude.length === 0) {
    return select
  }

  const clone = JSON.parse(JSON.stringify(select)) as Record<string, unknown>
  for (const path of exclude) {
    if (!path.includes('.')) {
      delete clone[path]
    } else {
      deleteAtPath(clone, path)
    }
  }
  return clone as PopulateSelect
}

/** Baseline select for `populate.media` — aligned with plugin hooks / `defaultPopulate`. */
export function getFullPopulateBase(): PopulateSelect {
  const defaultSelect = sanityMediaDefaultPopulateSelect()

  return deepMergeSelect(defaultSelect, {
    originalFilename: true,
    thumbnailURL: true,
    sync: {
      status: true,
      checkedAt: true,
    },
    sanity: {
      id: true,
      type: true,
      path: true,
      url: true,
      source: true,
      metadata: {
        dimensions: true,
        lqip: true,
        palette: true,
      },
    },
  })
}

function buildPopulateSelect(
  factoryDefaults?: PopulateOptions,
  callOverrides?: PopulateOptions
): PopulateSelect {
  let select = getFullPopulateBase()

  if (factoryDefaults?.extend) {
    select = deepMergeSelect(select, factoryDefaults.extend)
  }
  if (callOverrides?.extend) {
    select = deepMergeSelect(select, callOverrides.extend)
  }

  const exclude = [...(factoryDefaults?.exclude ?? []), ...(callOverrides?.exclude ?? [])]
  return applyExcludes(select, exclude)
}

export function createPopulate(factoryDefaults?: PopulateOptions): PopulateFn {
  return (callOverrides?: PopulateOptions) => buildPopulateSelect(factoryDefaults, callOverrides)
}

/** Default full media populate map for `populate: { [mediaSlug]: fullPopulate() }`. */
export const fullPopulate: PopulateFn = createPopulate()
