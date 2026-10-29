/**
 * Validates runtime public exports from dist against scripts/public-api.contract.json.
 * Type names in the contract are declared API only (not verified from dist).
 * Run with Bun so extensionless dist imports resolve (bundler-first dist layout).
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contractPath = join(dirname(fileURLToPath(import.meta.url)), 'public-api.contract.json')

const SUBPATH_TO_DIST = {
  '.': 'dist/index.js',
  './admin': 'dist/admin/index.js',
  './client': 'dist/sanity/client/index.js',
  './next': 'dist/presentation/adapters/next/index.js',
  './next/loader': 'dist/presentation/adapters/next/loader.js',
}

function sortedUnique(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b))
}

function diffSets(label, expected, actual) {
  const missing = expected.filter((name) => !actual.includes(name))
  const extra = actual.filter((name) => !expected.includes(name))
  const lines = []
  if (missing.length) lines.push(`${label}: missing ${missing.join(', ')}`)
  if (extra.length) lines.push(`${label}: unexpected ${extra.join(', ')}`)
  return lines
}

const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
const errors = []

for (const subpath of Object.keys(SUBPATH_TO_DIST)) {
  const entry = contract[subpath]
  if (!entry) {
    errors.push(`${subpath}: missing contract entry`)
    continue
  }

  const distFile = join(root, SUBPATH_TO_DIST[subpath])
  let mod
  try {
    mod = await import(pathToFileURL(distFile).href)
  } catch (err) {
    errors.push(`${subpath}: failed to import ${SUBPATH_TO_DIST[subpath]}: ${err.message}`)
    continue
  }

  const hasDefault = 'default' in mod && mod.default !== undefined
  if (Boolean(entry.default) !== hasDefault) {
    errors.push(`${subpath}: default export expected=${entry.default} actual=${hasDefault}`)
  }

  const actualRuntime = sortedUnique(Object.keys(mod).filter((key) => key !== 'default'))
  const expectedRuntime = sortedUnique(entry.runtime ?? [])
  errors.push(...diffSets(`${subpath} runtime`, expectedRuntime, actualRuntime))

  const expectedTypes = sortedUnique(entry.types ?? [])
  const contractTypes = sortedUnique(entry.types ?? [])
  if (expectedTypes.join(',') !== contractTypes.join(',')) {
    errors.push(`${subpath}: types array must be sorted unique`)
  }
}

if (process.env.PSS_UPDATE_PUBLIC_API_CONTRACT === '1') {
  console.error(
    'PSS_UPDATE_PUBLIC_API_CONTRACT is not implemented; edit public-api.contract.json intentionally.'
  )
  process.exit(1)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(
  `public API contract OK (${Object.keys(SUBPATH_TO_DIST).length} subpaths, runtime from dist)`
)
