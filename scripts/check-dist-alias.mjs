import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(import.meta.dirname, '..', 'dist')
if (!existsSync(dist)) {
  console.error('dist/ missing — run build:dist first')
  process.exit(1)
}

const out = execSync('rg "@/" dist || true', { encoding: 'utf8' }).trim()
if (out) {
  console.error('Unresolved @/ imports in dist:\n', out)
  process.exit(1)
}
