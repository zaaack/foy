import * as execa from 'execa'
import * as pathLib from 'path';
import { logger as _logger } from './logger'
export { execa }

export function exec(command: string, options?: execa.Options): execa.ExecaChildProcess
export function exec(commands: string[], options?: execa.Options): Promise<execa.ExecaReturns[]>
export async function exec(commands: string | string[], options?: execa.Options) {
  if (typeof commands === 'string') {
    return execa.shell(commands, options)
  }

  let rets: execa.ExecaReturns[] = []
  for(let cmd of commands) {
    rets.push(await execa.shell(cmd, options))
  }
  return rets
}
export const spawn = execa

export class ShellContext {
  private _cwd = process.cwd()
  private _env = { ...process.env }
  cwd() {
    return this._cwd
  }
  cd(path: string) {
    this._cwd = pathLib.resolve(this._cwd, path)
  }
  exec(command: string, options?: execa.Options): execa.ExecaChildProcess
  exec(commands: string[], options?: execa.Options): Promise<execa.ExecaReturns[]>
  exec(commands: string | string[], options?: execa.Options): any {
    return exec(commands as any, {
      cwd: this._cwd,
      env: this._env,
      stdio: 'inherit',
      ...options,
    }).catch(err => {
      let logger: typeof _logger = require('./logger').logger
      logger.error('Exec failed: ', commands)
      throw err
    })
  }
  spawn(file: string, args?: string[], options?: execa.Options): execa.ExecaChildProcess {
    return spawn(file, args, {
      cwd: this._cwd,
      env: this._env,
      stdio: 'inherit',
      ...options,
    }).catch(err => {
      let logger: typeof _logger = require('./logger').logger
      logger.error('Spawn failed: ', file, args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' '))
      throw err
    }) as any
  }
  env(key: string, val: string) {
    this._env[key] = val
    return this._env
  }
}

export async function shell(callback: (ctx: ShellContext) => Promise<any>) {
  return callback(new ShellContext())
}
