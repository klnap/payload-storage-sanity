import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @param {string} tgzPath absolute path to `bun pm pack` tarball
 * @returns {string[]} error messages (empty if valid)
 */
export function validatePackedTarball(tgzPath) {
  const errors = []
  const files = execFileSync('tar', ['-tzf', tgzPath], { encoding: 'utf8' }).trim().split('\n')
  const allowedFile = (file) =>
    [
      'package/package.json',
      'package/README.md',
      'package/CHANGELOG.md',
      'package/LICENSE',
    ].includes(file) || /^package\/(?:dist|docs)\/.+$/.test(file)
  const unexpectedFile = files.find((file) => !allowedFile(file))
  if (unexpectedFile) errors.push(`unexpected packed file: ${unexpectedFile}`)

  const pkgJsonRaw = execFileSync('tar', ['-xOzf', tgzPath, 'package/package.json'], {
    encoding: 'utf8',
  })
  const packed = JSON.parse(pkgJsonRaw)
  const source = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  if (packed.name !== source.name || packed.version !== source.version) {
    errors.push('packed package name/version must match package.json')
  }
  if (packed.repository?.url !== source.repository?.url) {
    errors.push('packed repository metadata must match package.json')
  }
  for (const file of [
    'package/package.json',
    'package/README.md',
    'package/CHANGELOG.md',
    'package/LICENSE',
  ]) {
    if (!files.includes(file)) errors.push(`required package file is missing: ${file}`)
  }

  for (const [subpath, entry] of Object.entries(packed.exports ?? {})) {
    const targets =
      typeof entry === 'string'
        ? [entry]
        : Object.values(entry).filter((value) => typeof value === 'string')
    if (!targets.length) errors.push(`${subpath}: packed export has no string targets`)
    for (const target of targets) {
      if (!target.startsWith('./dist/')) {
        errors.push(`${subpath}: packed export must point at dist, got ${target}`)
        continue
      }
      try {
        execFileSync('tar', ['-xOzf', tgzPath, `package/${target.slice(2)}`], {
          stdio: 'ignore',
        })
      } catch {
        errors.push(`${subpath}: packed export target missing: ${target}`)
      }
    }
  }

  for (const target of [packed.main, packed.types].filter((value) => typeof value === 'string')) {
    if (!target.startsWith('./dist/')) errors.push(`packed ${target} metadata must point at dist`)
  }

  if (packed.publishConfig?.exports) {
    errors.push('packed manifest must not rely on publishConfig.exports (unsupported by npm)')
  }

  for (const file of files.filter(
    (path) => path.startsWith('package/dist/') && path.endsWith('.js')
  )) {
    const js = execFileSync('tar', ['-xOzf', tgzPath, file], { encoding: 'utf8' })
    if (js.includes('@/')) errors.push(`${file} still contains @/ aliases`)
  }

  return errors
}
