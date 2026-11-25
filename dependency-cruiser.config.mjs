import { buildMatrixForbiddenRules } from './scripts/domain-matrix.mjs'

const BANNED_FOLDER_SEGMENT = '(^|/)(morph|lib|utils|common|helpers|misc|shared)(/|$)'

/** Max feature nesting depth (e.g. features/media/lifecycle/dedupe/index.ts). */
const INDEX_BARREL_DEPTH = 6

function indexBarrelPathNotPrefixes(topLevel) {
  const paths = []
  for (let depth = 0; depth <= INDEX_BARREL_DEPTH; depth += 1) {
    const segments = depth === 0 ? '' : Array(depth).fill('[^/]+').join('/')
    paths.push(`^src/${topLevel}${segments ? `/${segments}` : ''}/index\\.ts$`)
  }
  return paths
}

function allV3IndexBarrelViaNot() {
  const tops = ['core', 'sanity', 'features', 'presentation', 'admin']
  return tops.flatMap((top) => indexBarrelPathNotPrefixes(top))
}

function buildCrossTopLevelBarrelRules() {
  const tops = ['core', 'sanity', 'features', 'presentation', 'admin']
  const rules = []

  for (const from of tops) {
    for (const to of tops) {
      if (from === to) continue
      rules.push({
        name: `cross-v3-${from}-to-${to}-via-barrel`,
        comment: `${from}/ must import ${to}/ only through index.ts barrels`,
        severity: 'error',
        from: { path: `^src/${from}/`, pathNot: [BANNED_FOLDER_SEGMENT] },
        to: {
          path: `^src/${to}/`,
          pathNot: indexBarrelPathNotPrefixes(to),
        },
      })
    }
  }

  for (const root of ['index', 'plugin']) {
    for (const to of tops) {
      rules.push({
        name: `cross-v3-${root}-to-${to}-via-barrel`,
        comment: `${root}.ts must import ${to}/ only through index.ts barrels`,
        severity: 'error',
        from: { path: `^src/${root}\\.ts$` },
        to: {
          path: `^src/${to}/`,
          pathNot: indexBarrelPathNotPrefixes(to),
        },
      })
    }
  }

  return rules
}

/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  forbidden: [
    {
      name: 'no-circular',
      comment:
        'Real cycles only — paths closing through domain index.ts barrels are re-export artifacts',
      severity: 'error',
      from: {},
      to: {
        circular: true,
        viaNot: allV3IndexBarrelViaNot(),
      },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: [
          '^src/index\\.ts$',
          '^src/plugin\\.ts$',
          '^src/consumers/index\\.ts$',
          '^src/consumers/next/index\\.ts$',
          '^src/consumers/next/loader\\.ts$',
        ],
      },
      to: {},
    },
    {
      name: 'core-contracts-allowlist',
      comment:
        'src/core/contracts/ may only contain shared modules (jsonValue, documentId) plus index barrel',
      severity: 'error',
      from: {
        path: '^src/core/contracts/',
        pathNot: [
          '^src/core/contracts/index\\.ts$',
          '^src/core/contracts/jsonValue\\.ts$',
          '^src/core/contracts/documentId\\.ts$',
        ],
      },
      to: {},
    },
    {
      name: 'banned-folder-segments',
      comment: 'No morph/lib/utils/common/helpers/misc/shared directory names',
      severity: 'error',
      from: { path: BANNED_FOLDER_SEGMENT },
      to: {},
    },
    ...buildCrossTopLevelBarrelRules(),
    {
      name: 'model-no-runtime-payload',
      severity: 'error',
      from: { path: '/model/' },
      to: {
        dependencyTypes: ['npm'],
        dependencyTypesNot: ['type-only'],
        path: '(^|/)node_modules/(payload(/|$)|@payloadcms/)',
      },
    },
    {
      name: 'model-no-runtime-react-next',
      severity: 'error',
      from: { path: '/model/' },
      to: {
        dependencyTypes: ['npm'],
        dependencyTypesNot: ['type-only'],
        path: '(^|/)node_modules/(react|react-dom|next)(/|$)',
      },
    },
    {
      name: 'model-no-runtime-sanity-client',
      severity: 'error',
      from: { path: '/model/' },
      to: {
        dependencyTypes: ['npm'],
        dependencyTypesNot: ['type-only'],
        path: '(^|/)node_modules/@sanity/client(/|$)',
      },
    },
    {
      name: 'model-no-runtime-cdn-domain',
      severity: 'error',
      from: { path: '/model/' },
      to: { path: '^src/features/media/cdn/' },
    },
    {
      name: 'model-no-runtime-admin-next',
      severity: 'error',
      from: { path: '/model/' },
      to: { path: '^src/(admin|consumers/next)/' },
    },
    {
      name: 'presentation-image-no-react-next',
      comment: 'consumers/image is framework-agnostic (no React or Next runtime imports)',
      severity: 'error',
      from: { path: '^src/consumers/image/' },
      to: {
        dependencyTypes: ['npm'],
        dependencyTypesNot: ['type-only'],
        path: '(^|/)node_modules/(react|react-dom|next)(/|$)',
      },
    },
    {
      name: 'consumer-framework-independent-no-framework-or-node-imports',
      comment:
        'Framework-independent consumer exports must not import server, Node, React, or Next modules',
      severity: 'error',
      from: { path: '^src/consumers/(?!next/)' },
      to: {
        dependencyTypes: ['npm'],
        path: '(^|/)node_modules/(next/|next$|react/|react$|react-dom/)',
      },
    },
    {
      name: 'consumer-no-payload-imports',
      comment: 'Frontend consumers must not import Payload server packages',
      severity: 'error',
      from: { path: '^src/consumers/' },
      to: {
        dependencyTypes: ['npm'],
        path: '(^|/)node_modules/(payload|@payloadcms/)',
      },
    },
    {
      name: 'consumer-no-node-builtins',
      comment: 'Frontend consumers must not import Node.js built-ins',
      severity: 'error',
      from: { path: '^src/consumers/' },
      to: {
        dependencyTypes: ['core'],
        path: '^node:',
      },
    },
    {
      name: 'consumer-no-payload-server-source',
      comment:
        'Frontend consumers must not depend on Payload server implementations or credentials',
      severity: 'error',
      from: { path: '^src/consumers/' },
      to: { path: '^src/(plugin\\.ts$|admin/|features/|core/config/)' },
    },
    {
      name: 'server-src-no-admin',
      comment: 'Non-presentation src must not import admin UI tree (plugin/index may wire admin)',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['^src/admin/', '^src/plugin\\.ts$', '^src/index\\.ts$'],
      },
      to: { path: '^src/admin/' },
    },
    {
      name: 'server-src-no-next-consumers',
      comment: 'Non-consumer src must not import Next.js consumer modules',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['^src/presentation/', '^src/consumers/next/'],
      },
      to: { path: '^src/consumers/next/' },
    },
    ...buildMatrixForbiddenRules(),
  ],
  options: {
    exclude: { path: '\\.(?:test|spec)\\.tsx?$' },
    doNotFollow: { path: 'node_modules' },
    parser: 'swc',
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
}

export default config
