#!/usr/bin/env node

import * as cac from 'cac'
import { fs } from './fs'
import { TaskManager, getGlobalTaskManager } from './task'
import * as pathLib from 'path'
import { logger } from './logger';

const defaultCli = cac()

let defaultArgv: string[] = []
let taskArgv: string[] = []

{
  const argv = process.argv.slice(2)
  const defaultOptions = new Map([
    ['--config', 1],
    ['-c', 1],
    ['--require', 1],
    ['-r', 1],
  ])
  let i = 0
  for (i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (defaultOptions.has(arg)) {
      let valLen = defaultOptions.get(arg)
      let end = i + valLen
      defaultArgv.push(...argv.slice(i, end + 1))
      i = end
    } else {
      break
    }
  }
  taskArgv = argv.slice(i)
}
defaultArgv = process.argv.slice(0, 2).concat(defaultArgv)
taskArgv = process.argv.slice(0, 2).concat(taskArgv)

const DefaultOptionsCount = 3
function addDefaultOptions(cli: ReturnType<typeof cac>) {
  return cli
    .option(`--config, -c <...files>`, 'The Foyfiles')
    .option(`--require, -r <...names>`, 'Require the given modules')
}

addDefaultOptions(defaultCli)
.parse(defaultArgv)

let foyFiles: string[] = arrify(defaultCli.options.config)
let registers: string[] = arrify(defaultCli.options.require)

function arrify(arr: any | any[]) {
  if (!Array.isArray(arr)) {
    return arr == null ? [] : [arr]
  }
  return arr
}
if (foyFiles.length) {
  foyFiles = foyFiles.map(c => pathLib.resolve(process.cwd(), c))
} else {
  let cwdFoyfiles = fs.readdirSync(process.cwd()).filter(f => f.startsWith('Foyfile.'))
  if (cwdFoyfiles.length) {
    if (cwdFoyfiles.length > 1) {
      logger.warn(`Find more than 1 Foyfile in current directory, only first one will be used: \n${cwdFoyfiles.join('\n')}`)
    }
    foyFiles = [pathLib.join(process.cwd(), cwdFoyfiles[0])]
  }
}

for (const file of foyFiles) {
  if (!fs.existsSync(file)) {
    throw new TypeError(`Cannot find Foyfile: ${file}`)
  }
}

if (registers.length) {
  for (const mod of registers) {
    require(mod)
  }
}

try {
  require('ts-node/register')
} catch (error) {
  // ignore
}

for (const file of foyFiles) {
  require(file)
}

const taskCli = cac()

addDefaultOptions(taskCli)

let taskManager = getGlobalTaskManager()
taskManager.getTasks().forEach(t => {
  let strict = taskManager.globalOptions.strict || t.strict
  let cmd = taskCli
    .command(t.name, t.desc, { allowUnknownOptions: !strict })
  if (t.optionDefs) {
    t.optionDefs.forEach(def => cmd.option(...def))
  }
  cmd.option('-h, --help', 'Display this message')
  cmd.action((...args) => {
    let options = args.pop()
    taskManager.run(t.name, { options, args: taskCli.rawArgs.slice(3) })
  })
})

taskCli.on('command:*', () => {
  console.error(`error: Unknown command \`${taskCli.args.join(' ')}\``)
  taskCli.outputHelp()
  process.exit(1)
})

taskCli.help(sections => {
  if (taskCli.matchedCommand) {
    let last = sections[sections.length - 1]
    last.body = last.body.split('\n').slice(0, -DefaultOptionsCount).join('\n')
  }
  console.log(sections
    .map(section => {
      return section.title
          ? `${section.title}:\n${section.body}`
          : section.body
    })
    .join('\n\n'))
  process.exit(0)
})
taskCli.parse(taskArgv)
