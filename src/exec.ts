import execa from 'execa'
import pathLib from 'path'
import { logger, logger as _logger } from './logger'
import { sleep, Is, DefaultLogFile } from './utils'
import { fs } from './fs'
import { Stream, Writable } from 'stream'
const shellParser = require('shell-parser')
export { execa }

function _exec(cmd: string, options?: execa.Options) {
  let [file, ...args] = shellParser(cmd)
  return execa(file, args, options)
}
export function exec(command: string, options?: execa.Options): execa.ExecaChildProcess
export function exec(commands: string[], options?: execa.Options): Promise<execa.ExecaSyncReturnValue<string>[]>
export function exec(commands: string | string[], options?: execa.Options) {
  if (Is.str(commands)) {
    return _exec(commands, options)
  }

  const rets: execa.ExecaSyncReturnValue<string>[]  = []
  let retsP: Promise<execa.ExecaSyncReturnValue<string>[]> = Promise.resolve(null as any)
  for (const cmd of commands) {
    retsP = retsP.then(() => {
      return _exec(cmd, options).then(r => {
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
  private _env: {[k: string]: string | undefined} = {}
  logCommand = false
  sleep = sleep
  /**
   * get current word directory
   */
  get cwd() {
    return this._cwdStack[this._cwdStack.length - 1]
  }
  protected _logger = logger
  /**
   * change work directory
   * @param dir
   */
  cd(dir: string) {
    this._cwdStack[this._cwdStack.length - 1] = pathLib.resolve(this._cwdStack[this._cwdStack.length - 1], dir)
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
        ...this._env
      },
      stdio: 'inherit',
      ...options,
    })
    // tslint:disable-next-line:no-floating-promises
    p.catch(err => {
      this._logger.error('Exec failed: ', commands)
      throw err
    })
    return p
  }
  /**
   * spawn file
   * @param file
   * @param args
   * @param options
   */
  spawn(file: string, args: string[] = [], options?: execa.Options): execa.ExecaChildProcess {
    const command = file + ' ' + args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')
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
    p.catch(err => {
      this._logger.error('Exec failed: ', command)
      throw err
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
   */
  monitor(dir: string, run: (ctx: ShellContext) => execa.ExecaChildProcess | Promise<execa.ExecaChildProcess>, {
    throttle
  }: {
    throttle?: number
  }) {
    let p: execa.ExecaChildProcess | null = null
    fs.watchDir(dir, { throttle }, async (event, file) => {
      while (p && !p.killed) {
        p && p.kill()
        await sleep(500)
      }
      let ret = run(this)
      if ('kill' in ret) {
        p = ret
      } else {
        await ret.then(r => {
          p=r
          return
        })
      }
    })
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
      let env = Object.keys(this._env).map(k => `${k}=${this._env[k] || ''}`).join(' ')
      if (env) {
        env += ' '
      }
      cmd = Array.isArray(cmd) ? cmd : [cmd]
      cmd.forEach(cmd => {
        this._logger.info(`$ ${env}${cmd}`)
      })
    }
  }
}

export async function shell(callback: (ctx: ShellContext) => Promise<any>) {
  return callback(new ShellContext())
}
