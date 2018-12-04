#!/usr/bin/env node

import * as cac from 'cac'
import { fs } from './fs'
import { TaskManager, getGlobalTaskManager } from './task'
import * as pathLib from 'path'

const defaultCli = cac()

try {
  require('ts-node/register')
} catch (error) {
  // ignore
}

defaultCli.option('--config, -c <...file>', 'The Foyfile')

defaultCli.parse()

let foyFile: string = ''

if (defaultCli.options.config && defaultCli.options.config.length) {
  let config =
    typeof defaultCli.options.config === 'string'
      ? defaultCli.options.config
      : defaultCli.options.config[0]
  foyFile = pathLib.resolve(process.cwd(), config)
} else {
  foyFile = pathLib.join(process.cwd(), 'Foyfile.js')
  if (!fs.existsSync(foyFile)) {
    foyFile = pathLib.join(process.cwd(), 'Foyfile.ts')
  }
}

if (!fs.existsSync(foyFile)) {
  throw new TypeError(`Cannot find Foyfile: ${foyFile}`)
}

require(foyFile)

const taskCli = cac()

taskCli
.option('--config, -c file', 'The Foyfile.js')

let taskManager = getGlobalTaskManager()
taskManager.getTasks().forEach(t => {
  let strict = taskManager.globalOptions.strict || t.strict
  let cmd = taskCli
    .command(t.name, t.desc, { allowUnknownOptions: !strict })
  if (t.optionDefs) {
    t.optionDefs.forEach(def => cmd.option(...def))
  }
  cmd.option('-h, --help', 'helps')
  cmd.action((...args) => {
    let options = args.pop()
    if (options.help) {
      cmd.outputHelp()
      return
    }
    taskManager.run(t.name, { options, args: taskCli.rawArgs.slice(3) })
  })
})

taskCli.on('command:*', () => {
  console.error(`error: Unknown command \`${taskCli.args.join(' ')}\``)
  process.exit(1)
})

taskCli.help()

let taskArgv = process.argv.slice()
{ // Remove config args
  let configIdx = taskArgv.findIndex(t => t === '--config' || t === '-c')
  if (configIdx >= 0) {
    taskArgv.splice(configIdx, 2)
  }
}
taskCli.parse(taskArgv)
