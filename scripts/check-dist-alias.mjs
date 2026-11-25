import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(import.meta.dirname, '..', 'dist')
if (!existsSync(dist)) {
  console.error('dist/ missing — run build:dist first')
  process.exit(1)
}

function findAliases(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return findAliases(path)
    return readFileSync(path, 'utf8').includes('@/') ? [path] : []
  })
}

const unresolved = findAliases(dist)
if (unresolved.length) {
  console.error('Unresolved @/ imports in dist:\n', unresolved.join('\n'))
  process.exit(1)
}
