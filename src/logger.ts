import chalk from 'chalk'
import { getGlobalTaskManager } from './task-manager'
import util from 'util'
import stripAnsi from 'strip-ansi'

export const LogLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}
export type LogLevels = keyof (typeof LogLevels)
function makeLogger(level: LogLevels, logger: Logger) {
  return (...args: any[]) => {
    const { _props: props } = logger
    let levelNum = LogLevels[level]
    let filterLevelNum =
      LogLevels[props.level || 'debug']
    let message = props.format!(level, props.levelColor![level], args)
    if (levelNum >= filterLevelNum && !props.hideConsole) {
      console.log(message)
    }
    props.onLog &&
      props.onLog({
        level,
        message: stripAnsi(message),
        levelNum,
        filter: filterLevelNum,
        args,
      })
  }
}

export interface ILogInfo {
  level: LogLevels
  message: string
  levelNum: number
  args: any[]
  filter: number
}

export interface ILoggerProps {
  onLog?(info: ILogInfo): void
  hideConsole?: boolean
  level?: string
  format?(level: string, color: (v: string) => string, args: any[]): string
  levelColor?: { [k in LogLevels]: (v: string) => string }
}

export class Logger {
  static get defaultProps(): ILoggerProps {
    return {
      levelColor: {
        debug: chalk.blueBright,
        info: chalk.green,
        warn: chalk.yellow,
        error: chalk.red,
      },
      format(level, color, args) {
        return `${color(`[${level}]`)} ${args
          .map(a => typeof a === 'string' ? a : util.inspect(a, false, 5))
          .join(' ')}`
      },
      level: 'debug',
    }
  }
  /** @internal */
  _props: ILoggerProps
  constructor(
    _props: ILoggerProps = {},
  ) {
    this._props = {
      ...Logger.defaultProps,
      ..._props,
    }
  }
  debug = makeLogger('debug', this)
  info = makeLogger('info', this)
  log = makeLogger('info', this)
  warn = makeLogger('warn', this)
  error = makeLogger('error', this)
}

export const logger = new Logger()
