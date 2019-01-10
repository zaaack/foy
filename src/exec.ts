import * as execa from 'execa'
import * as pathLib from 'path'
import { logger as _logger } from './logger'
import { Dependency, RunTaskOptions, TaskManager } from './task';
import { sleep } from './utils';
export { execa }

export function exec(command: string, options?: execa.Options): execa.ExecaChildProcess
export function exec(commands: string[], options?: execa.Options): Promise<execa.ExecaReturns[]>
export async function exec(commands: string | string[], options?: execa.Options) {
  if (typeof commands === 'string') {
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
  private _cwd = process.cwd()
  private _env = { ...process.env }
  logCommand = false
  sleep = sleep
  cwd(cwd = this._cwd) {
    return (this._cwd = cwd)
  }
  cd(path: string) {
    this._cwd = pathLib.resolve(this._cwd, path)
    return this
  }
  run(task: Dependency, options?: RunTaskOptions) {
    let taskManager: TaskManager = require('./task').getGlobalTaskManager()
    let name = typeof task === 'string' ? task : task.name
    return taskManager.run(name, {
      force: true,
      loading: false,
      ...options,
    })
  }
  exec(command: string, options?: execa.Options): execa.ExecaChildProcess
  exec(commands: string[], options?: execa.Options): Promise<execa.ExecaReturns[]>
  exec(commands: string | string[], options?: execa.Options): any {
    let logger: typeof _logger = require('./logger').logger
    if (this.logCommand) {
      logger.info('Exec: ', commands)
    }
    return exec(commands as any, {
      cwd: this._cwd,
      env: this._env,
      stdio: 'inherit',
      ...options,
    }).catch(err => {
      logger.error('Exec failed: ', commands)
      throw err
    })
  }
  spawn(file: string, args?: string[], options?: execa.Options): execa.ExecaChildProcess {
    let logger: typeof _logger = require('./logger').logger
    const command = file + ' ' + args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')
    if (this.logCommand) {
      logger.info('Exec: ', command)
    }
    return spawn(file, args, {
      cwd: this._cwd,
      env: this._env,
      stdio: 'inherit',
      ...options,
    }).catch(err => {
      logger.error('Spawn failed: ', command)
      throw err
    }) as any
  }
  env(key: string): string
  env(key: string, val: string | undefined): this
  env(key: string, val?: string): string | this {
    if (arguments.length === 1) {
      return this._env[key]
    }
    this._env[key] = val
    return this
  }
}

export async function shell(callback: (ctx: ShellContext) => Promise<any>) {
  return callback(new ShellContext())
}
