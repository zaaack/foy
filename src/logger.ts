import chalk from 'chalk'
import { getGlobalTaskManager } from './task'

const Levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}
function makeLogger(level: keyof (typeof Levels), color: (s: string) => string) {
  return (...args: any[]) => {
    let levelNum = Levels[level]
    let taskManager = getGlobalTaskManager()
    let curLevelNum = Levels[taskManager.globalOptions.logLevel || 'debug']
    if (levelNum >= curLevelNum) {
      console.log(color(`[${level}]`), ...args)
    }
  }
}

export const logger = {
  debug: makeLogger('debug', chalk.blueBright),
  info: makeLogger('info', chalk.green),
  warn: makeLogger('warn', chalk.yellow),
  error: makeLogger('error', chalk.red),
}
