import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackedTarball } from './validate-packed-artifact.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = mkdtempSync(join(tmpdir(), 'pss-pack-check-'))

try {
  execSync(`npm pack --pack-destination ${JSON.stringify(tmp)}`, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  const listing = execSync(`ls -1 ${JSON.stringify(tmp)}`, { encoding: 'utf8' })
  const tgzName = listing
    .trim()
    .split('\n')
    .find((line) => line.endsWith('.tgz'))
  if (!tgzName) {
    console.error('npm pack did not produce a tarball')
    process.exit(1)
  }

  const tgzPath = join(tmp, tgzName)
  const errors = validatePackedTarball(tgzPath)

  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exit(1)
  }

  console.log('npm pack artifact validates (import→dist, files present, no @/ in dist)')

  execSync('node scripts/verify-css-side-effects.mjs', { cwd: root, stdio: 'inherit' })
  execSync('bun run check:publint', { cwd: root, stdio: 'inherit' })
  execSync('node scripts/check-attw.mjs', { cwd: root, stdio: 'inherit' })
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
