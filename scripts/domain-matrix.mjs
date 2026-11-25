/**
 * v3 domain dependency matrix (ADR-0007).
 * Top-level folders under src/: core, sanity, features, presentation, admin.
 * Used to generate dependency-cruiser forbidden rules.
 */

export const V3_TOP_LEVEL = ['core', 'sanity', 'features', 'presentation', 'admin']

/** @type {Record<string, string[]>} */
export const V3_ALLOWED = {
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

  for (const from of V3_TOP_LEVEL) {
    const allowed = new Set(V3_ALLOWED[from] ?? [])
    for (const to of V3_TOP_LEVEL) {
      if (from === to) continue
      if (allowed.has(to)) continue
      rules.push({
        name: `matrix-v3-${from}-not-${to}`,
        comment: `v3 layout: ${from}/ must not import ${to}/`,
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
    const allowed = new Set(V3_ALLOWED[key] ?? [])
    for (const to of V3_TOP_LEVEL) {
      if (allowed.has(to)) continue
      rules.push({
        name: `matrix-v3-${key}-not-${to}`,
        comment: `${file} must not import ${to}/`,
        severity: 'error',
        from: { path: `^src/${file.replace('.', '\\.')}$` },
        to: { path: `^src/${to}/` },
      })
    }
  }

  return rules
}

/** @deprecated v2 domain list — kept for scripts that still import TARGET_DOMAINS */
export const TARGET_DOMAINS = V3_TOP_LEVEL

export const TARGET_ALLOWED = V3_ALLOWED

export function buildMatrixForbiddenRulesLegacy() {
  return buildMatrixForbiddenRules()
}
