import {
  $ as _$,
  execa,
  execaCommand,
  type Options,
  type ResultPromise,
  type Result,
  type ExecaScriptMethod,
  execaNode,
  TemplateExpression,
  VerboseObject,
} from 'execa'
import pathLib from 'path'
import { logger, logger as _logger } from './logger'
import { sleep, Is, DefaultLogFile } from './utils'
import { fs, WatchDirOptions } from './fs'
import { Stream, Writable } from 'stream'
import { ChildProcess, ExecOptions, spawn } from 'child_process'
import { createRequire } from 'module'

function _logCmd(cmd: string, env?: object) {
  let envStr = Object.keys(env || {})
    .map((k) => `${k}=${env?.[k] || ''}`)
    .join(' ')
  if (envStr) {
    envStr += ' '
  }
  logger.info(`$ ${envStr}${cmd}`)
}

function joinTag(strings: TemplateStringsArray, ...values: TemplateExpression[]): string {
  return strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')
}

const verbose = (verboseLine: string, verboseObject: VerboseObject) => {
  if (verboseObject.type === 'command') {
    const env = verboseObject.options.env
    const extraEnv: Record<string, string> = {}
    for (const k of Object.keys(env || {})) {
      if (!(k in process.env) || env![k] !== process.env[k]) {
        extraEnv[k] = env![k] as string
      }
    }
    _logCmd(verboseObject.escapedCommand, Object.keys(extraEnv).length ? extraEnv : undefined)
  }
}

const DefaultExecaOptions: Options = {
  stdio: 'inherit',
  shell: true,
  verbose: verbose,
  extendEnv: true,
}

export const $ = _$(DefaultExecaOptions)
export function exec(cmd: string, options?: Options): ResultPromise<Options> {
  // _logCmd(cmd, options?.env)
  return execaCommand(cmd, {
    ...DefaultExecaOptions,
    ...options,
  })
}

export class ShellContext {
  private _cwdStack = [process.cwd()]
  private _env: { [k: string]: string | undefined } = {}
  logCommand = false
  execaOptions: Options | undefined
  sleep = sleep
  /**
   * get current word directory
   */
  get cwd() {
    return this._cwdStack[this._cwdStack.length - 1]
  }
  protected _logger = logger
  private readonly _process: {
    current: ResultPromise<Options> | null
  } = { current: null }
  /**
   * change work directory
   * @param dir
   */
  cd(dir: string) {
    this._cwdStack[this._cwdStack.length - 1] = pathLib.resolve(
      this._cwdStack[this._cwdStack.length - 1],
      dir,
    )
    return this
  }
  /**
   * like pushd in shell
   * @param dir
   */
  pushd(dir: string) {
    this._cwdStack.push(pathLib.resolve(this._cwdStack[this._cwdStack.length - 1], dir))
    return this
  }
  /**
   * like popd in shell
   */
  popd() {
    this._cwdStack.pop()
    return this
  }

  get $() {
    return $({
      env: {
        ...this._env,
      },
      verbose: this.logCommand ? verbose : undefined,
    })
  }

  /**
   * NOTE!!!: New multiple commands are written as a single string with multiple lines,
   * execute command,
   *
   * @param command
   * @param options
   * @example
   * ```ts
   * await ctx.exec('echo 1')
   *
   * await ctx.exec(`
   *   echo 1
   *   sleep 1
   *   echo 2
   * `)
   * ```
   */
  exec(command: string, options?: Options): ResultPromise<Options> {
    let p = exec(command, {
      cwd: this.cwd,
      env: {
        ...this._env,
      },
      stdio: 'inherit',
      verbose: this.logCommand ? verbose : undefined,
      ...options,
    })
    // tslint:disable-next-line:no-floating-promises
    this._process.current = p
    return p
  }
  /**
   * set/get/delete env
   * set: ctx.env('key', 'val')
   * set: ctx.env('key=val')
   * delete: ctx.env('key', void 0)
   * @param key
   */
  env(key: string): this
  env(key: string, val: string | undefined): this
  env(key: string, val?: string): string | undefined | this {
    if (arguments.length === 1) {
      ;[key, val] = key.split('=', 2)
    }
    if (Is.defined(val)) {
      this._env[key] = val
    } else {
      delete this._env[key]
    }
    return this
  }
  /**
   * restart processes when file changes
   * @example
   *  ctx.monitor('./src', 'tsc')
   *  ctx.monitor('./src', 'webpack')
   *  ctx.monitor('./src', 'foy watch')
   *  ctx.monitor('./src', ['rm -rf dist', 'foy watch'])
   *  ctx.monitor('./src', async p => {
   *    await fs.rmrf('dist')
   *    p.current = ctx.exec('webpack serve')
   *  })
   */
  monitor(
    dir: string,
    run: ((p: { current: ChildProcess | null }) => void) | string | string[],
    options: WatchDirOptions & {
      ignore?: (event: string, file: string | null) => boolean
    } = {},
  ) {
    let p = this._process
    if (typeof run === 'string') {
      let cmd = run
      run = (p) => (p.current = this.exec(cmd) as ResultPromise)
    }
    if (Array.isArray(run)) {
      let cmds = run
      run = async (p) => {
        for (const cmd of cmds.slice(0, -1)) {
          await this.exec(cmd)
        }
        p.current = this.exec(cmds.slice(-1)[0]) as ResultPromise
      }
    }
    fs.watchDir(dir, options, async (event, file) => {
      if (options.ignore && options.ignore(event, file)) {
        return
      }
      while (p.current && !p.current.killed && p.current.exitCode === null) {
        p.current.kill()
        await sleep(100)
      }
      run(p)
    })
    run(p)
  }
  /**
   * reset env to default
   */
  resetEnv() {
    this._env = {}
    return this
  }
}

export async function shell(callback: (ctx: ShellContext) => Promise<any>) {
  return callback(new ShellContext())
}
