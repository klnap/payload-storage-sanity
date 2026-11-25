/**
 * Layer dependency matrix (ADR-0007).
 * Top-level folders under src/: core, sanity, features, presentation, admin.
 * Used to generate dependency-cruiser forbidden rules.
 */

export const LAYER_DIRECTORIES = ['core', 'sanity', 'features', 'presentation', 'admin']

/** @type {Record<string, string[]>} */
export const LAYER_ALLOWED_IMPORTS = {
  core: [],
  sanity: ['core'],
  features: ['core', 'sanity'],
  presentation: ['core', 'sanity', 'features'],
  admin: ['core', 'sanity', 'features'],
  plugin: ['core', 'sanity', 'features', 'admin'],
  index: ['core', 'sanity', 'features'],
}

export function buildMatrixForbiddenRules() {
  const rules = []

  for (const from of LAYER_DIRECTORIES) {
    const allowed = new Set(LAYER_ALLOWED_IMPORTS[from] ?? [])
    for (const to of LAYER_DIRECTORIES) {
      if (from === to) continue
      if (allowed.has(to)) continue
      rules.push({
        name: `matrix-layer-${from}-not-${to}`,
        comment: `layer: ${from}/ must not import ${to}/`,
        severity: 'error',
        from: { path: `^src/${from}/` },
        to: { path: `^src/${to}/` },
      })
    }
  }

  for (const [file, key] of [
    ['plugin.ts', 'plugin'],
    ['index.ts', 'index'],
  ]) {
    const allowed = new Set(LAYER_ALLOWED_IMPORTS[key] ?? [])
    for (const to of LAYER_DIRECTORIES) {
      if (allowed.has(to)) continue
      rules.push({
        name: `matrix-layer-${key}-not-${to}`,
        comment: `${file} must not import ${to}/`,
        severity: 'error',
        from: { path: `^src/${file.replace('.', '\\.')}$` },
        to: { path: `^src/${to}/` },
      })
    }
  }

  return rules
}
