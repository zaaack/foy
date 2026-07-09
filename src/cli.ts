#!/usr/bin/env node

import { fs } from './fs'
import { extname, join, resolve } from 'path'
import { logger } from './logger'
import { initDefaultCli } from './default-cli'
import { spawn, execSync, ChildProcess } from 'child_process'
import { access, constants } from 'fs/promises'

const { foyFiles, registers, defaultCli } = initDefaultCli()

const CACHE_DIR = join(process.cwd(), 'node_modules', '.cache')
const CACHE_FILE = join(CACHE_DIR, 'foyCache.json')

interface TsCache {
  executor: string
  registers?: string[]
}

function isTsFile(file: string) {
  return ['.ts', '.cts', '.tsx', '.ctsx'].includes(extname(file))
}

function isJsFile(file: string) {
  return ['.js', '.cjs', '.mjs', '.jsx'].includes(extname(file))
}

async function readCache(): Promise<TsCache | null> {
  try {
    const data = await fs.readJson<TsCache>(CACHE_FILE)
    if (data?.executor) return data
  } catch {}
  return null
}

async function writeCache(data: TsCache) {
  await fs.mkdirp(CACHE_DIR)
  await fs.outputJson(CACHE_FILE, data, { space: 2 })
}

async function deleteCache() {
  try {
    await fs.promises.unlink(CACHE_FILE)
  } catch {}
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd} 2>/dev/null`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function localBin(name: string): Promise<string | null> {
  const binPath = resolve(process.cwd(), 'node_modules', '.bin', name)
  try {
    await access(binPath, constants.X_OK)
    return binPath
  } catch {
    return null
  }
}

async function detectTsExecutor(pkg: any): Promise<TsCache> {
  const isESM = pkg.type === 'module'
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  // Priority: bun (global) > tsx (local) > tsx (global) > ts-node (local) > @swc-node/register (local) > swc-node (local)
  if (commandExists('bun')) {
    return { executor: 'bun' }
  }

  const localTsx = await localBin('tsx')
  if (localTsx) {
    return { executor: localTsx }
  }

  if (commandExists('tsx')) {
    return { executor: 'tsx' }
  }

  const localTsNode = await localBin('ts-node')
  if (localTsNode) {
    const localTsNodeEsm = isESM ? await localBin('ts-node-esm') : null
    return {
      executor: localTsNodeEsm || localTsNode,
    }
  }

  if ('@swc-node/register' in deps) {
    const registers = isESM
      ? ['@swc-node/register/esm-register']
      : ['@swc-node/register']
    return { executor: 'node', registers }
  }

  const localSwcNode = await localBin('swc-node')
  if (localSwcNode) {
    return { executor: localSwcNode }
  }

  logger.error('no bun/tsx/ts-node/swc-node or @swc-node/register found')
  process.exit(1)
}

async function main() {
  const pkg = await fs.readJson('./package.json')
  const results: ChildProcess[] = []

  for (const foyFile of foyFiles) {
    let executor = defaultCli.options.executor
    let fileRegisters: string[] = [...registers]

    if (!executor) {
      if (isJsFile(foyFile)) {
        executor = 'node'
      } else if (isTsFile(foyFile)) {
        // Try cache first
        const cached = await readCache()
        if (cached?.executor) {
          executor = cached.executor
          if (cached.registers) {
            fileRegisters.push(...cached.registers)
          }
        } else {
          // Detect and cache
          const detected = await detectTsExecutor(pkg)
          executor = detected.executor
          if (detected.registers) {
            fileRegisters.push(...detected.registers)
          }
          await writeCache(detected)
        }
      } else {
        executor = 'node'
      }
    }

    const args = [
      ...fileRegisters.map((r) => `--${pkg.type === 'module' ? 'import' : 'require'} ${r}`),
      foyFile,
      ...process.argv.slice(2),
    ]

    let NODE_OPTIONS = process.env.NODE_OPTIONS ?? ''
    ;[
      ['--inspect', defaultCli.options.inspect],
      ['--inspectBrk', defaultCli.options.inspectBrk],
    ].map(([inspect, inspectVal]) => {
      if (inspectVal) {
        if (typeof inspectVal === 'string') {
          inspect += '=' + inspectVal
        }
        NODE_OPTIONS += ' ' + inspect
      }
    })

    const p = spawn(executor, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_OPTIONS,
      },
    })

    // Watch for errors - if cached executor fails, delete cache and retry
    if (!defaultCli.options.executor && isTsFile(foyFile)) {
      const cached = await readCache()
      if (cached?.executor) {
        p.on('error', async () => {
          logger.warn(`Executor "${cached.executor}" failed to start, clearing cache and retrying...`)
          await deleteCache()
          main().catch((err) => {
            console.error(err)
            process.exitCode = 1
          })
        })
        p.on('exit', async (code) => {
          if (code !== 0 && code !== null) {
            logger.warn(`Executor "${cached.executor}" exited with code ${code}, clearing cache...`)
            await deleteCache()
          }
        })
      }
    }

    results.push(p)
  }

  for (const p of results) {
    await new Promise<void>((resolve) => p.on('exit', () => resolve()))
    if (p.exitCode !== 0 && p.exitCode !== null) {
      process.exitCode = p.exitCode
    }
  }

  // fix zombie process sometimes
  process.on('SIGINT', () => {
    results.forEach((p) => {
      p.kill(9)
    })
  })
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
