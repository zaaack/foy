import chalk from 'chalk'
import util from 'util'
import stripAnsi from 'strip-ansi'
import { formatDate } from './utils'

export const LogLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}
export type LogLevels = keyof typeof LogLevels
function makeLogger(level: LogLevels, logger: Logger) {
  return (...args: any[]) => {
    const { _props: props } = logger
    let levelNum: number = LogLevels[level]
    let filterLevelNum: number = LogLevels[props.level || 'debug']
    const time = props.logTime
      ? typeof props.logTime === 'function'
        ? props.logTime()
        : formatDate(new Date())
      : ''
    let message = (props.format || Logger.defaultProps.format!)(
      level,
      time,
      props.levelColor![level],
      args,
    )
    if (levelNum >= filterLevelNum && !props.hideConsole) {
      console.log(message)
    }
    props.onLog &&
      props.onLog({
        level,
        time: new Date(),
        formatedTime: time,
        message: stripAnsi(message),
        levelNum,
        filterLevelNum,
        args,
      })
  }
}

export interface ILogInfo {
  level: LogLevels
  time: Date
  formatedTime: string
  message: string
  levelNum: number
  args: any[]
  filterLevelNum: number
}

export interface ILoggerProps {
  onLog?(info: ILogInfo): void
  hideConsole?: boolean
  level?: string
  logTime?: boolean | (() => string)
  format?(level: string, time: string, color: (v: string) => string, args: any[]): string
  levelColor?: { [k in LogLevels]: (v: string) => string }
}

export class Logger {
  static defaultProps = {
    logTime: false,
    levelColor: {
      debug: chalk.blueBright,
      info: chalk.green,
      warn: chalk.yellow,
      error: chalk.red,
    },
    format(level, time, color, args) {
      return `${color(`[${level}]`)}${time ? ' ' + time : ''} ${args
        .map((a) => (typeof a === 'string' ? a : util.inspect(a, false, 5)))
        .join(' ')}`
    },
    level: 'debug',
  } satisfies ILoggerProps
  /** @internal */
  _props: ILoggerProps
  constructor(_props: ILoggerProps = {}) {
    this._props = Object.create(Logger.defaultProps)
    Object.assign(this._props, _props)
  }
  debug = makeLogger('debug', this)
  info = makeLogger('info', this)
  log = makeLogger('info', this)
  warn = makeLogger('warn', this)
  error = makeLogger('error', this)
}

export const logger = new Logger()
