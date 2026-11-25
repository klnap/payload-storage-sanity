// Builds dist without ever exposing half-built output to consumers (tsc emits `@/` aliases that
// tsc-alias only resolves afterwards): compile into dist.stage, then move files into dist.
//
// - dist.lock serializes whole builds, so a build always compiles the source as it is after the
//   previous publish and an older build can never overwrite a newer one.
// - Each file swap is an atomic rename. The directory as a whole is NOT a snapshot: new files go
//   first (nothing imports a module that is not there yet), then changed files, then stale files
//   are removed. Changed files may briefly mix old and new versions; an interrupted publish is
//   completed by the next build.
// - Unchanged files are left untouched to keep their mtimes (no needless consumer rebuilds).
import { spawn } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const stage = join(root, 'dist.stage')
const lock = join(root, 'dist.lock')

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const list = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? list(join(dir, e.name)) : [join(dir, e.name)]
  )
const same = (a, b) => {
  try {
    return readFileSync(a).equals(readFileSync(b))
  } catch {
    return false
  }
}

let child
const run = (command, args) =>
  new Promise((done, fail) => {
    // shell only for Windows .cmd shims (untested); POSIX runs the binary directly
    child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.once('error', fail)
    child.once('close', (code) =>
      code === 0 ? done() : fail(new Error(`${command} exited with code ${code}`))
    )
  })

function acquireLock() {
  const deadline = Date.now() + 300_000
  for (;;) {
    try {
      const fd = openSync(lock, 'wx')
      writeSync(fd, String(process.pid))
      closeSync(fd)
      return
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      try {
        process.kill(Number(readFileSync(lock, 'utf8')) || process.pid, 0)
      } catch (e) {
        if (e.code === 'ESRCH') rmSync(lock, { force: true }) // owner died mid-build
      }
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${lock}`)
      sleep(50)
    }
  }
}

function publish() {
  const staged = list(stage).map((file) => ({ file, rel: relative(stage, file) }))
  const pending = staged
    .map((entry) => ({ ...entry, target: join(dist, entry.rel) }))
    .filter(({ file, target }) => !same(file, target))
    .map((entry) => ({ ...entry, isNew: !existsSync(entry.target) }))
  for (const { file, target } of [
    ...pending.filter((e) => e.isNew),
    ...pending.filter((e) => !e.isNew),
  ]) {
    mkdirSync(dirname(target), { recursive: true })
    renameSync(file, target)
  }

  const keep = new Set(staged.map(({ rel }) => rel))
  if (!existsSync(dist)) return
  for (const file of list(dist)) if (!keep.has(relative(dist, file))) rmSync(file)
  const prune = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory()) prune(join(dir, e.name))
    if (dir !== dist && !readdirSync(dir).length) rmdirSync(dir)
  }
  prune(dist)
}

const cleanup = () => {
  rmSync(stage, { recursive: true, force: true })
  rmSync(lock, { force: true })
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    child?.kill()
    cleanup()
    process.exit(1)
  })
}

acquireLock()
try {
  rmSync(stage, { recursive: true, force: true }) // leftovers of a killed build; the lock proves none is running
  await run('tsc', ['-p', 'tsconfig.build.json', '--outDir', 'dist.stage'])
  await run('tsc-alias', ['-p', 'tsconfig.build.json', '--outDir', 'dist.stage'])
  mkdirSync(join(stage, 'admin/tailwind'), { recursive: true })
  await run('tailwindcss', [
    '-i',
    './src/admin/tailwind/entry.css',
    '-o',
    './dist.stage/admin/tailwind/admin-tailwind.css',
    '--minify',
  ])
  // The prefixed gallery utilities are built separately: a second `utilities` import in one
  // entry would switch off source detection for the unprefixed admin utilities.
  await run('tailwindcss', [
    '-i',
    './src/admin/tailwind/gallery.css',
    '-o',
    './dist.stage/admin/tailwind/gallery.css',
    '--minify',
  ])
  const galleryCss = join(stage, 'admin/tailwind/gallery.css')
  appendFileSync(join(stage, 'admin/tailwind/admin-tailwind.css'), readFileSync(galleryCss))
  rmSync(galleryCss)
  publish()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  cleanup()
}
