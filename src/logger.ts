import chalk from 'chalk'
import { getGlobalTaskManager } from './task-manager'
import * as util from 'util'

export const LogLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}
function makeLogger(
  level: keyof (typeof LogLevels),
  color: (s: string) => string,
  props: ILoggerProps
) {
  return (...args: any[]) => {
    let levelNum = LogLevels[level]
    let taskManager = getGlobalTaskManager()
    let curLevelNum = LogLevels[taskManager.globalOptions.logLevel || 'debug']
    if (levelNum >= curLevelNum) {
      console.log(color(`[${level}]`), ...args)
      props.onLog && props.onLog({
        level,
        message: args.map(a => util.inspect(a, false, null)).join(' '),
        levelNum,
        args,
      })
    }
  }
}

export interface ILogInfo {
  level: keyof (typeof LogLevels)
  message: string
  levelNum: number
  args: any[]
}

export interface ILoggerProps {
  onLog?(info: ILogInfo): void
}

export class Logger {
  constructor(
    /** @internal */
    public _props: ILoggerProps = {}
  ) {
  }
  debug = makeLogger('debug', chalk.blueBright, this._props)
  info = makeLogger('info', chalk.green, this._props)
  log = makeLogger('info', chalk.green, this._props)
  warn = makeLogger('warn', chalk.yellow, this._props)
  error = makeLogger('error', chalk.red, this._props)
}

export const logger = new Logger()
