import * as execa from 'execa'
import * as pathLib from 'path'
import { logger as _logger } from './logger'
import { sleep, Is, DefaultLogFile } from './utils'
import { fs } from './fs'
import { Stream, Writable } from 'stream'
export { execa }

export function exec(command: string, options?: execa.Options): execa.ExecaChildProcess
export function exec(commands: string[], options?: execa.Options): Promise<execa.ExecaReturns[]>
export async function exec(commands: string | string[], options?: execa.Options) {
  if (Is.str(commands)) {
    return execa.shell(commands, options)
  }

  let rets: execa.ExecaReturns[] = []
  for (let cmd of commands) {
    rets.push(await execa.shell(cmd, options))
  }
  return rets
}
export const spawn = execa

export class ShellContext {
  private _cwdStack = [process.cwd()]
  private _env: {[k: string]: string | undefined} = {}
  logCommand = false
  sleep = sleep
  redirectLog?: boolean | string | Writable
  get cwd() {
    return this._cwdStack[this._cwdStack.length - 1]
  }
  private get _logger() {
    let logger: typeof _logger = require('./logger').logger
    return logger
  }
  cd(dir: string) {
    this._cwdStack[this._cwdStack.length - 1] = pathLib.resolve(this._cwdStack[this._cwdStack.length - 1], dir)
    return this
  }
  pushd(dir: string) {
    this._cwdStack.push(pathLib.resolve(this._cwdStack[this._cwdStack.length - 1], dir))
    return this
  }
  popd() {
    this._cwdStack.pop()
    return this
  }
  exec(command: string, options?: execa.Options): execa.ExecaChildProcess
  exec(commands: string[], options?: execa.Options): Promise<execa.ExecaReturns[]>
  exec(commands: string | string[], options?: execa.Options): any {
    this._logCmd(commands)
    let p = exec(commands as any, {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...this._env
      },
      stdio: this.redirectLog ? 'pipe' : 'inherit',
      ...options,
    })
    let redirectLogStream = this._getRedirectLogFile()
    if (redirectLogStream) {
      // tslint:disable-next-line:no-floating-promises
      p.then(p => {
        p.stdout && redirectLogStream!.write(p.stdout)
        p.stderr && redirectLogStream!.write(p.stderr)
        redirectLogStream!.end()
      })
    }
    // tslint:disable-next-line:no-floating-promises
    p.catch(err => {
      this._logger.error('Exec failed: ', commands)
      if (redirectLogStream) {
        redirectLogStream.end()
      }
      throw err
    })
    return p
  }
  spawn(file: string, args: string[] = [], options?: execa.Options): execa.ExecaChildProcess {
    const command = file + ' ' + args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')
    this._logCmd(command)
    let p = spawn(file, args, {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...this._env,
      },
      stdio: this.redirectLog ? 'pipe' : 'inherit',
      ...options,
    })
    let redirectLogStream = this._getRedirectLogFile()
    if (redirectLogStream) {
      // tslint:disable-next-line:no-floating-promises
      p.then(p => {
        p.stdout && redirectLogStream!.write(p.stdout)
        p.stderr && redirectLogStream!.write(p.stderr)
        redirectLogStream!.end()
      })
    }
    // tslint:disable-next-line:no-floating-promises
    p.catch(err => {
      this._logger.error('Exec failed: ', command)
      if (redirectLogStream) {
        redirectLogStream.end()
      }
      throw err
    })
    return p
  }
  env(key: string): string | undefined
  env(key: string, val: string | undefined): this
  env(key: string, val?: string): string | undefined | this {
    if (arguments.length === 1) {
      return this._env[key]
    }
    this._env[key] = val
    return this
  }
  resetEnv() {
    this._env = {}
    return this
  }
  private _getRedirectLogFile() {
    if (!this.redirectLog) return null
    if (this.redirectLog instanceof Writable) {
      return this.redirectLog
    }
    let logFile = Is.str(this.redirectLog) ? this.redirectLog : DefaultLogFile
    return fs.createWriteStream(logFile, { mode: fs.constants.O_APPEND })
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
