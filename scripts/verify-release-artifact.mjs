import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { validatePackedTarball } from './validate-packed-artifact.mjs'

const root = process.cwd()
const packDir = process.env.PACK_DIR
const expectedRepository = process.env.EXPECTED_REPOSITORY
const sourceSha = process.env.GITHUB_SHA
if (!packDir || !expectedRepository || !sourceSha) {
  throw new Error('PACK_DIR, EXPECTED_REPOSITORY, and GITHUB_SHA are required')
}

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const publishPlan = JSON.parse(readFileSync(resolve(packDir, 'publish-plan.json'), 'utf8'))
const releases = publishPlan.plan.flat().filter((release) => release.kind === 'publish')
if (releases.length !== 1) {
  throw new Error(`Expected one package tarball, found ${releases.length}`)
}

const release = releases[0]
if (release.name !== packageJson.name || release.version !== packageJson.version) {
  throw new Error('Changesets publish plan does not match package.json')
}

const tarball = resolve(packDir, release.tarball.path)
const relativeTarball = relative(resolve(packDir), tarball)
if (!relativeTarball || relativeTarball.startsWith('..') || isAbsolute(relativeTarball)) {
  throw new Error('Changesets tarball path escapes its artifact directory')
}

const [algorithm, encodedDigest] = String(release.tarball.integrity).split('-', 2)
if (!['sha256', 'sha384', 'sha512'].includes(algorithm) || !encodedDigest) {
  throw new Error('Changesets publish plan has an unsupported tarball integrity')
}
const digest = createHash(algorithm).update(readFileSync(tarball)).digest('base64')
if (digest !== encodedDigest) {
  throw new Error('Packed tarball integrity does not match the Changesets publish plan')
}

const packed = JSON.parse(
  execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' })
)
if (packed.name !== release.name || packed.version !== release.version) {
  throw new Error('Tarball identity does not match the Changesets publish plan')
}
if (packed.repository?.url !== `git+${expectedRepository}`) {
  throw new Error('Tarball repository does not match this GitHub repository')
}
if (
  packed.private === true ||
  packed.publishConfig?.access !== 'public' ||
  packed.publishConfig?.registry !== 'https://registry.npmjs.org/'
) {
  throw new Error('Tarball publishing metadata is unsafe')
}

const errors = validatePackedTarball(tarball)
if (errors.length) throw new Error(errors.join('\n'))

execFileSync('bun', ['scripts/check-pack.mjs', '--tarball', tarball], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})
execFileSync('bun', ['scripts/run-release-matrix.mjs', '--use-dist', '--tarball', tarball], {
  cwd: root,
  env: { ...process.env, PSS_REQUIRE_POSTGRES_CONSUMER: '1' },
  stdio: 'inherit',
})

console.log(`Verified ${release.name}@${release.version} from source ${sourceSha}`)
