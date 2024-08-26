#!/usr/bin/env node

import cac from 'cac'
import { fs } from './fs'
import pathLib, { extname } from 'path'
import os from 'os'
import { logger } from './logger'
import { Is } from './utils'
import { getGlobalTaskManager } from './task-manager'
import chalk from 'chalk'
import { initDefaultCli } from './default-cli'
import { spawn } from 'child_process'

const { foyFiles, registers } = initDefaultCli()
async function main() {
  const pkg = await fs.readJson('./package.json')
  const isESM = pkg.type === 'module'
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  for (const foyFile of foyFiles) {
    let env = 'node'
    if (['.ts', '.cts', '.tsx', '.ctsx'].includes(extname(foyFile))) {
      if ('ts-node' in deps) {
        env = 'ts-node'
      } else if ('tsx' in deps) {
        env = 'tsx'
      } else if ('@swc-node/register' in deps) {
        if (isESM) {
          registers.push('@swc-node/register/esm-register')
        } else {
          registers.push('@swc-node/register')
        }
      } else if ('swc-node' in deps) {
        env = 'swc-node'
      } else {
        logger.error('no ts-node/tsx/swc-node or @swc-node/register found')
        process.exit(1)
      }
    }
    const args = [
      ...registers.map((r) => `--${isESM ? 'import' : 'require'} ${r}`),
      foyFile,
      ...process.argv.slice(2),
    ]
    spawn(env, args, {
      stdio: 'inherit'
    })
  }
}

main().catch((err) => {
  console.error(err)
})
