import * as execa from 'execa'
import * as pathLib from 'path'
import { logger as _logger } from './logger'
import { sleep, Is, DefaultLogFile } from './utils';
import { fs } from './fs';
import { Stream, Writable } from 'stream';
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
  private _env = { ...process.env }
  logCommand = false
  sleep = sleep
  redirectLog?: boolean | string | Writable
  get cwd() {
    return this._cwdStack[this._cwdStack.length - 1]
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
    let logger: typeof _logger = require('./logger').logger
    if (this.logCommand) {
      logger.info('$', commands)
    }
    let p = exec(commands as any, {
      cwd: this.cwd,
      env: this._env,
      stdio: this.redirectLog ? 'pipe' : 'inherit',
      ...options,
    })
    let redirectLogStream = this._getRedirectLogFile()
    if (redirectLogStream) {
      p.then(p => {
        p.stdout && redirectLogStream!.write(p.stdout)
        p.stderr && redirectLogStream!.write(p.stderr)
        redirectLogStream!.end()
      })
    }
    p.catch(err => {
      logger.error('Exec failed: ', commands)
      redirectLogStream!.end()
      throw err
    })
    return p
  }
  spawn(file: string, args: string[] = [], options?: execa.Options): execa.ExecaChildProcess {
    let logger: typeof _logger = require('./logger').logger
    const command = file + ' ' + args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')
    if (this.logCommand) {
      logger.info('Exec: ', command)
    }
    let p = spawn(file, args, {
      cwd: this.cwd,
      env: this._env,
      stdio: this.redirectLog ? 'pipe' : 'inherit',
      ...options,
    })
    let redirectLogStream = this._getRedirectLogFile()
    if (redirectLogStream) {
      p.then(p => {
        p.stdout && redirectLogStream!.write(p.stdout)
        p.stderr && redirectLogStream!.write(p.stderr)
        redirectLogStream!.end()
      })
    }
    p.catch(err => {
      logger.error('Exec failed: ', command)
      redirectLogStream!.end()
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
  private _getRedirectLogFile() {
    if (!this.redirectLog) return null
    let stream: Writable
    if (this.redirectLog instanceof Writable) {
      return this.redirectLog
    }
    let logFile = Is.str(this.redirectLog) ? this.redirectLog : DefaultLogFile
    return fs.createWriteStream(logFile, { mode: fs.constants.O_APPEND })
  }
}

export async function shell(callback: (ctx: ShellContext) => Promise<any>) {
  return callback(new ShellContext())
}
