import type { CollectionConfig } from 'payload'

import { sanityMediaDefaultPopulateSelect } from '../options/mediaDefaultPopulateSelect'

export type PopulateSelect = NonNullable<CollectionConfig['defaultPopulate']>

export type PopulateOptions = {
  extend?: PopulateSelect
  exclude?: string[]
}

export type PopulateFn = (overrides?: PopulateOptions) => PopulateSelect

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

// Reads own properties only, so a key such as "constructor" never resolves to an inherited value.
function ownValue(target: object, key: string): unknown {
  return Object.hasOwn(target, key) ? (target as Record<string, unknown>)[key] : undefined
}

function deepMergeSelect(base: PopulateSelect, patch: PopulateSelect): PopulateSelect {
  const out: PopulateSelect = { ...base }

  for (const [key, value] of Object.entries(patch)) {
    // "__proto__" as a key would set the prototype of the merged object instead of adding a field.
    if (key === '__proto__') continue
    if (value === true) {
      out[key] = true
      continue
    }
    const current = ownValue(out, key)
    if (isPlainObject(value) && isPlainObject(current)) {
      out[key] = deepMergeSelect(current as PopulateSelect, value as PopulateSelect)
      continue
    }
    out[key] = value
  }

  return out as PopulateSelect
}

function deleteAtPath(target: Record<string, unknown>, path: string): void {
  const parts = path.split('.')
  let node: Record<string, unknown> = target

  for (const part of parts.slice(0, -1)) {
    if (!Object.hasOwn(node, part)) {
      return
    }
    const next = node[part]
    if (!isPlainObject(next)) {
      return
    }
    node = next
  }

  const last = parts.at(-1) ?? ''
  if (Object.hasOwn(node, last)) {
    delete node[last]
  }
}

function applyExcludes(select: PopulateSelect, exclude: string[]): PopulateSelect {
  if (exclude.length === 0) {
    return select
  }

  const clone = structuredClone(select) as Record<string, unknown>
  for (const path of exclude) {
    if (!path.includes('.')) {
      if (Object.hasOwn(clone, path)) delete clone[path]
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
    thumbnailURL: true,
    sync: {
      status: true,
      checkedAt: true,
    },
    sanity: {
      asset: {
        _id: true,
        _type: true,
        path: true,
        url: true,
        originalFilename: true,
        metadata: {
          dimensions: true,
          lqip: true,
          palette: true,
        },
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
