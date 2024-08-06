import execa from 'execa'
import pathLib from 'path'
import { logger, logger as _logger } from './logger'
import { sleep, Is, DefaultLogFile } from './utils'
import { fs, WatchDirOptions } from './fs'
import { Stream, Writable } from 'stream'
import { ChildProcess } from 'child_process'
const shellParser = require('shell-parser')
export { execa }

function _exec(cmd: string, options?: execa.Options) {
  let [file, ...args] = shellParser(cmd)
  return execa(file, args, options)
}
export function exec(command: string, options?: execa.Options): execa.ExecaChildProcess
export function exec(
  commands: string[],
  options?: execa.Options,
): Promise<execa.ExecaSyncReturnValue<string>[]>
export function exec(commands: string | string[], options?: execa.Options): any {
  if (Is.str(commands)) {
    return _exec(commands, options)
  }

  const rets: execa.ExecaSyncReturnValue<string>[] = []
  let retsP: Promise<execa.ExecaSyncReturnValue<string>[]> = Promise.resolve(null as any)
  for (const cmd of commands) {
    retsP = retsP.then(() => {
      return _exec(cmd, options).then((r) => {
        rets.push(r)
        return rets
      })
    })
  }
  return retsP
}
export const spawn = execa

export class ShellContext {
  private _cwdStack = [process.cwd()]
  private _env: { [k: string]: string | undefined } = {}
  logCommand = false
  sleep = sleep
  /**
   * get current word directory
   */
  get cwd() {
    return this._cwdStack[this._cwdStack.length - 1]
  }
  protected _logger = logger
  private readonly _process: {
    current: ChildProcess | null
  } = {current: null}
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
  /**
   * execute command(s)
   * @param command
   * @param options
   */
  exec(command: string, options?: execa.Options): execa.ExecaChildProcess
  exec(commands: string[], options?: execa.Options): Promise<execa.ExecaSyncReturnValue[]>
  exec(commands: string | string[], options?: execa.Options): any {
    this._logCmd(commands)
    let p = exec(commands as any, {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...this._env,
      },
      stdio: 'inherit',
      ...options,
    })
    // tslint:disable-next-line:no-floating-promises
    p.catch((err) => {
      this._logger.error('Exec failed: ', commands)
      throw err
    })
    this._process.current = p
    p.finally(() => {
      this._process.current = null
    })
    return p
  }
  /**
   * exec (multi-line) cmd in *unix platforms,
   * via `this.spawn('$SHELL', ['-i','-c', cmd])`
   * @param cmd
   * @param options
   * @returns
   */
  exec_unix(cmd: string, options?: execa.Options) {
    return this.spawn('$SHELL', ['-i','-c', cmd])
  }
  /**
   * spawn file
   * @param file
   * @param args
   * @param options
   */
  spawn(file: string, args: string[] = [], options?: execa.Options): execa.ExecaChildProcess {
    const command = file + ' ' + args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')
    this._logCmd(command)
    let p = spawn(file, args, {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...this._env,
      },
      stdio: 'inherit',
      ...options,
    })
    // tslint:disable-next-line:no-floating-promises
    p.catch((err) => {
      this._logger.error('Exec failed: ', command)
      throw err
    })
    this._process.current = p
    p.finally(() => {
      this._process.current = null
    })
    return p
  }
  /**
   * set/get/delete env
   * set: ctx.env('key', 'val')
   * get: ctx.env('key')
   * delete: ctx.env('key', void 0)
   * @param key
   */
  env(key: string): string | undefined
  env(key: string, val: string | undefined): this
  env(key: string, val?: string): string | undefined | this {
    if (arguments.length === 1) {
      return this._env[key]
    }
    if (Is.defed(val)) {
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
      ignore?: (event: string, file: string) => boolean,
    } = {},
  ) {
    let p = this._process
    if (typeof run === 'string') {
      let cmd = run
      run = (p) => (p.current = this.exec(cmd))
    }
    if (Array.isArray(run)) {
      let cmds = run
      run = async (p) => {
        for (const cmd of cmds.slice(0, -1)) {
          await this.exec(cmd)
        }
        p.current = this.exec(cmds.slice(-1)[0])
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
  private _logCmd(cmd: string | string[]) {
    if (this.logCommand) {
      let env = Object.keys(this._env)
        .map((k) => `${k}=${this._env[k] || ''}`)
        .join(' ')
      if (env) {
        env += ' '
      }
      cmd = Array.isArray(cmd) ? cmd : [cmd]
      cmd.forEach((cmd) => {
        this._logger.info(`$ ${env}${cmd}`)
      })
    }
  }
}

export async function shell(callback: (ctx: ShellContext) => Promise<any>) {
  return callback(new ShellContext())
}
