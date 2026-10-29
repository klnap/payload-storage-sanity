import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const subpaths = ['.', './admin', './client', './next', './next/loader']
const cssSubpath = './styles/admin-tailwind.css'

function resolveJsExportTarget(subpath) {
  const entry = pkg.exports[subpath]
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Missing exports entry for ${subpath}`)
  }
  if (!entry.import) {
    throw new Error(`${subpath} must define import (dist)`)
  }
  if (!String(entry.import).startsWith('./dist/')) {
    throw new Error(`${subpath} import must target dist: ${entry.import}`)
  }
  if (!entry.types || !String(entry.types).startsWith('./dist/')) {
    throw new Error(`${subpath} types must target dist declarations: ${entry.types}`)
  }
  return { import: entry.import, types: entry.types }
}

const missing = []

for (const subpath of subpaths) {
  const { import: distPath, types: typesPath } = resolveJsExportTarget(subpath)
  if (!existsSync(resolve(root, distPath))) {
    missing.push(`dist missing for ${subpath}: ${distPath} (run build:dist)`)
  }
  if (!existsSync(resolve(root, typesPath))) {
    missing.push(`dist types missing for ${subpath}: ${typesPath} (run build:dist)`)
  }
}

const cssPath = pkg.exports[cssSubpath]
if (!cssPath || typeof cssPath !== 'string' || !cssPath.startsWith('./dist/')) {
  missing.push(`${cssSubpath} must point at dist CSS`)
} else if (!existsSync(resolve(root, cssPath))) {
  missing.push(`dist CSS missing: ${cssPath} (run build:dist)`)
}

if (pkg.publishConfig?.exports) {
  missing.push('package.json must not use publishConfig.exports')
}

if (missing.length > 0) {
  console.error(missing.join('\n'))
  process.exit(1)
}

console.log('package exports map is valid (dist-only)')
