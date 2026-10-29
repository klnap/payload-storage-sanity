import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * Verifies every relative import in dist/*.js resolves to an emitted file.
 * Extensionless specifiers are intentional (bundler / Payload consumption).
 */
const distRoot = join(import.meta.dirname, '..', 'dist')
if (!existsSync(distRoot)) {
  console.error('dist/ missing — run build:dist first')
  process.exit(1)
}

const importRe = /from\s+['"](\.[^'"]+)['"]/g

function walk(dir, files = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) {
      walk(full, files)
    } else if (name.name.endsWith('.js')) {
      files.push(full)
    }
  }
  return files
}

const missing = []

for (const file of walk(distRoot)) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(importRe)) {
    const specifier = match[1]
    const base = resolve(dirname(file), specifier)
    const candidates = [base, `${base}.js`, join(base, 'index.js')]
    if (!candidates.some((p) => existsSync(p))) {
      missing.push({ from: file.replace(`${distRoot}/`, ''), specifier })
    }
  }
}

if (missing.length > 0) {
  console.error(
    'dist relative imports do not resolve to emitted files (raw Node ESM is not supported):\n',
    missing.map((m) => `  ${m.from} → ${m.specifier}`).join('\n')
  )
  process.exit(1)
}

console.log('dist relative imports resolve to emitted files')
