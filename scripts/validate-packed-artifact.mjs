import { execSync } from 'node:child_process'

/**
 * @param {string} tgzPath absolute path to npm pack tarball
 * @returns {string[]} error messages (empty if valid)
 */
export function validatePackedTarball(tgzPath) {
  const errors = []
  const pkgJsonRaw = execSync(`tar -xOzf ${JSON.stringify(tgzPath)} package/package.json`, {
    encoding: 'utf8',
  })
  const packed = JSON.parse(pkgJsonRaw)

  const subpaths = ['.', './admin', './client', './next', './next/loader']
  for (const subpath of subpaths) {
    const entry = packed.exports?.[subpath]
    const importPath = entry?.import
    const typesPath = entry?.types
    if (!importPath || !String(importPath).startsWith('./dist/')) {
      errors.push(`${subpath}: packed exports.import must point at dist, got ${importPath}`)
      continue
    }
    if (!typesPath || !String(typesPath).startsWith('./dist/')) {
      errors.push(`${subpath}: packed exports.types must point at dist, got ${typesPath}`)
      continue
    }
    for (const rel of [importPath, typesPath]) {
      try {
        execSync(`tar -xOzf ${JSON.stringify(tgzPath)} package/${String(rel).slice(2)}`, {
          stdio: 'ignore',
        })
      } catch {
        errors.push(`${subpath}: packed dist entry missing: ${rel}`)
      }
    }
  }

  if (packed.publishConfig?.exports) {
    errors.push('packed manifest must not rely on publishConfig.exports (unsupported by npm)')
  }

  const cssExport = packed.exports?.['./styles/admin-tailwind.css']
  if (!cssExport || typeof cssExport !== 'string' || !cssExport.startsWith('./dist/')) {
    errors.push(`./styles/admin-tailwind.css: packed export must point at dist, got ${cssExport}`)
  } else {
    try {
      execSync(`tar -xOzf ${JSON.stringify(tgzPath)} package/${String(cssExport).slice(2)}`, {
        stdio: 'ignore',
      })
    } catch {
      errors.push(`./styles/admin-tailwind.css: packed CSS missing: ${cssExport}`)
    }
  }

  const aliasOut = execSync(`tar -xOzf ${JSON.stringify(tgzPath)} package/dist/index.js`, {
    encoding: 'utf8',
  })
  if (aliasOut.includes('@/')) {
    errors.push('dist/index.js still contains @/ aliases')
  }

  return errors
}
