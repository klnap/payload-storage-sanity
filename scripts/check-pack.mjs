import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackedTarball } from './validate-packed-artifact.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = mkdtempSync(join(tmpdir(), 'pss-pack-check-'))

try {
  execFileSync('bun', ['pm', 'pack', '--destination', tmp], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  const tgzName = readdirSync(tmp).find((line) => line.endsWith('.tgz'))
  if (!tgzName) {
    throw new Error('bun pm pack did not produce a tarball')
  }

  const tgzPath = join(tmp, tgzName)
  const errors = validatePackedTarball(tgzPath)

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  console.log('bun pm pack artifact validates (import→dist, files present, no @/ in dist)')

  execFileSync('bun', ['scripts/verify-css-side-effects.mjs'], { cwd: root, stdio: 'inherit' })
  execFileSync('bun', ['run', 'check:publint'], { cwd: root, stdio: 'inherit' })
  execFileSync('bun', ['scripts/check-attw.mjs'], { cwd: root, stdio: 'inherit' })
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
