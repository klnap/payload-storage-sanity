/**
 * Ensures packed package.json marks CSS as side-effectful (webpack/Turbopack tree-shaking).
 * Set PSS_CSS_WEBPACK=1 for the production webpack bundle (CI: `bun run check:css-side-effects`).
 */
import { execSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackedTarball } from './validate-packed-artifact.mjs'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheRoot = join(packageRoot, '.cache')
const packDir = join(cacheRoot, 'pack-verify')
const npmCache = join(cacheRoot, 'npm')
const fixtureDir = join(packageRoot, 'scripts', 'css-sidefx-fixture')

function assertCssSideEffectsInPackageJson(pkg) {
  const se = pkg.sideEffects
  if (se === false) {
    return 'package.json sideEffects must not be false when exporting ./styles/admin-tailwind.css'
  }
  if (se === true) {
    return null
  }
  if (!Array.isArray(se) || se.length === 0) {
    return 'package.json sideEffects should list **/*.css (or equivalent) for the admin CSS export'
  }
  const joined = se.join(' ')
  if (!/\.css/.test(joined)) {
    return 'package.json sideEffects array must include a *.css pattern'
  }
  return null
}

function runWebpackCssRetentionCheck(tgzPath) {
  mkdirSync(cacheRoot, { recursive: true })
  copyFileSync(tgzPath, join(fixtureDir, 'package.tgz'))
  writeFileSync(
    join(fixtureDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'pss-css-sidefx-fixture',
        private: true,
        dependencies: {
          '@klnap/payload-storage-sanity': 'file:./package.tgz',
        },
      },
      null,
      2
    )}\n`
  )

  rmSync(join(fixtureDir, 'node_modules'), { recursive: true, force: true })
  rmSync(join(fixtureDir, 'out'), { recursive: true, force: true })

  const install = spawnSync('npm', ['install', '--ignore-scripts'], {
    cwd: fixtureDir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: npmCache },
  })
  if (install.status !== 0) {
    process.exit(install.status ?? 1)
  }

  const webpackBin = join(packageRoot, 'node_modules', '.bin', 'webpack')
  const build = spawnSync(webpackBin, ['--config', 'webpack.config.cjs'], {
    cwd: fixtureDir,
    stdio: 'inherit',
  })
  if (build.status !== 0) {
    process.exit(build.status ?? 1)
  }

  const bundle = readFileSync(join(fixtureDir, 'out', 'bundle.js'), 'utf8')
  if (!/tailwind|@layer|--tw-/.test(bundle)) {
    console.error('[verify-css-side-effects] CSS missing from production webpack bundle')
    process.exit(1)
  }

  console.log('[verify-css-side-effects] Production webpack bundle retains admin CSS.')
}

rmSync(packDir, { recursive: true, force: true })
mkdirSync(packDir, { recursive: true })

const pack = spawnSync('npm', ['pack', '--pack-destination', packDir, '--silent'], {
  cwd: packageRoot,
  encoding: 'utf8',
})
if (pack.status !== 0) {
  console.error(pack.stderr || pack.stdout)
  process.exit(pack.status ?? 1)
}

const tgzName = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
if (!tgzName) {
  console.error('npm pack did not produce a tarball')
  process.exit(1)
}

const tgzPath = join(packDir, tgzName)
const packErrors = validatePackedTarball(tgzPath)
if (packErrors.length) {
  console.error(packErrors.join('\n'))
  process.exit(1)
}

const packedJson = execSync(`tar -xOf ${JSON.stringify(tgzPath)} package/package.json`, {
  encoding: 'utf8',
})
const sideEffectsError = assertCssSideEffectsInPackageJson(JSON.parse(packedJson))
if (sideEffectsError) {
  console.error(`[verify-css-side-effects] ${sideEffectsError}`)
  process.exit(1)
}

console.log('[verify-css-side-effects] Packed package.json marks CSS as side-effectful.')

if (process.env.PSS_CSS_WEBPACK === '1') {
  runWebpackCssRetentionCheck(tgzPath)
}
