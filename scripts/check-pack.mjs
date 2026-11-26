import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackedTarball } from './validate-packed-artifact.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2).filter((arg) => arg !== '--')
const tarballArg = process.argv.indexOf('--tarball')
const requestedTarball = tarballArg === -1 ? args[0] : process.argv[tarballArg + 1]
if (tarballArg !== -1 && !requestedTarball) throw new Error('--tarball requires a tarball path')
const tmp = requestedTarball ? undefined : mkdtempSync(join(tmpdir(), 'pss-pack-check-'))

try {
  const tgzPath = requestedTarball
    ? isAbsolute(requestedTarball)
      ? requestedTarball
      : resolve(root, requestedTarball)
    : (() => {
        const output = execFileSync('npm', ['pack', '--pack-destination', tmp, '--json'], {
          cwd: root,
          encoding: 'utf8',
        })
        const result = JSON.parse(output)
        const pack = Array.isArray(result) ? result[0] : Object.values(result)[0]
        if (!pack?.filename) throw new Error('npm pack did not produce a tarball')
        return join(tmp, pack.filename)
      })()
  if (!existsSync(tgzPath)) {
    throw new Error(`Packed tarball does not exist: ${tgzPath}`)
  }
  const errors = validatePackedTarball(tgzPath)

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  console.log('npm pack artifact validates (exports resolve, files exist, no @/ aliases)')
  execFileSync('bun', ['scripts/verify-css-side-effects.mjs', '--tarball', tgzPath], {
    cwd: root,
    env: { ...process.env, PSS_CSS_WEBPACK: '1' },
    stdio: 'inherit',
  })
} finally {
  if (tmp) rmSync(tmp, { recursive: true, force: true })
}
