import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import webpack from 'webpack'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const generatedRoot = join(root, '.test-output')
const distEntry = join(root, 'dist/consumers/index.js')

if (!existsSync(distEntry)) {
  throw new Error('Build dist before checking consumer tree-shaking: run `bun run build:dist`.')
}

function bundle(entry, workDir, name) {
  return new Promise((resolve, reject) => {
    webpack(
      {
        context: workDir,
        mode: 'production',
        target: 'web',
        entry,
        output: {
          path: join(workDir, name),
          filename: 'bundle.js',
        },
        stats: 'errors-only',
      },
      (error, stats) => {
        if (error) return reject(error)
        if (!stats || stats.hasErrors()) {
          return reject(
            new Error(stats?.toString({ all: false, errors: true }) ?? 'Webpack failed')
          )
        }
        resolve(readFileSync(join(workDir, name, 'bundle.js'), 'utf8'))
      }
    )
  })
}

mkdirSync(generatedRoot, { recursive: true })
const workDir = mkdtempSync(join(generatedRoot, 'pss-consumer-tree-shaking-'))
try {
  writeFileSync(
    join(workDir, 'image-url.js'),
    `import { buildSanityImageUrl } from ${JSON.stringify(distEntry)};\nvoid buildSanityImageUrl;\n`
  )
  const imageBundle = await bundle('./image-url.js', workDir, 'image-url')
  if (/node_modules\/(payload|@payloadcms|next|react)|next\/image|node:/.test(imageBundle)) {
    throw new Error(
      'Framework-independent image URL bundle includes a server, Node, or Next.js module.'
    )
  }

  console.log(
    '[check:consumer-tree-shaking] Framework-independent URL imports exclude server/Next modules.'
  )
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
