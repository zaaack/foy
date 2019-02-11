#!/usr/bin/env node

import * as cac from 'cac'
import { fs } from './fs'
import * as pathLib from 'path'
import * as os from 'os'
import { logger } from './logger'
import { Is } from './utils'
import { getGlobalTaskManager } from './task-manager'
import * as pkg from '../package.json'

const defaultCli = cac()

let defaultArgv: string[] = []
let taskArgv: string[] = []

{
  const argv = process.argv.slice(2)
  const defaultOptions = new Map<string, number>([
    ['--config', 1],
    ['-c', 1],
    ['--require', 1],
    ['-r', 1],
    ['--init', 1],
    ['-i', 1],
  ])
  let i = 0
  for (i = 0; i < argv.length; i++) {
    const arg = argv[i]
    let valLen = defaultOptions.get(arg)
    if (Is.defed(valLen)) {
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

function addDefaultOptions(cli: ReturnType<typeof cac>) {
  return cli
    .option(`--config, -c <...files>`, 'The Foyfiles')
    .option(`--require, -r <...names>`, 'Require the given modules')
    .option(`--init, -i [ext]`, 'Generate the Foyfile, [ext] can be "ts" | "js", default is "js"')
}

addDefaultOptions(defaultCli)
.parse(defaultArgv)

if (defaultCli.options.init) {
  let ext = defaultCli.options.init
  if (!Is.str(ext)) {
    ext = 'js'
  }
  ext = ext.replace(/^\./, '')
  const file = `./Foyfile.${ext}`
  if (fs.existsSync(file)) {
    throw new Error(`Foyfile already exists: ${pathLib.resolve(file)}`)
  }
  fs.writeFileSync(file, `${ ext === 'js'
  ? `const { task, desc, option, fs } = require('foy')`
  : `import { task, desc, option, fs } from 'foy'` }

task('build', async ctx => {
  // Your build tasks
  await ctx.exec('tsc')
})

`)
  process.exit()
}

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
  let findFoyfiles = (baseDir: string) => {
    let cwdFoyfiles = fs.readdirSync(baseDir).filter(f => f.startsWith('Foyfile.'))
    if (cwdFoyfiles.length) {
      if (cwdFoyfiles.length > 1) {
        logger.warn(`Find more than 1 Foyfile in current directory, only first one will be used: \n${cwdFoyfiles.join('\n')}`)
      }
      foyFiles = [pathLib.join(baseDir, cwdFoyfiles[0])]
    }
  }
  findFoyfiles(process.cwd())
  if (!foyFiles.length) {
    let maxDepth = 5
    let dir = process.cwd()
    while (maxDepth-- && dir !== '/' && dir && !foyFiles.length) {
      dir = pathLib.dirname(dir)
      findFoyfiles(dir)
    }
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
  if (!require.extensions['.ts']) {
    require('ts-node/register')
  }
} catch (error) {
  // ignore
}

{// Add global installed foy to module.paths
  const Module = require('module')
  const nodeModulePaths = Module._nodeModulePaths
  const globalFoyPath = pathLib.join(__dirname, '..', '..')
  if (nodeModulePaths) {
    Module._nodeModulePaths = (...args) => {
      let paths = nodeModulePaths.apply(Module, args)
      if (Array.isArray(paths)) {
        paths.push(globalFoyPath)
      }
      return paths
    }
  }
}

for (const file of foyFiles) {
  require(file)
}

const taskCli = cac()

let taskManager = getGlobalTaskManager()
taskManager.getTasks().forEach(t => {
  let strict = taskManager.globalOptions.strict || t.strict
  let cmd = taskCli
    .command(t.name, t.desc, { allowUnknownOptions: !strict })
  if (t.optionDefs) {
    t.optionDefs.forEach(def => cmd.option(...def))
  }
  cmd.action((...args) => {
    let options = args.pop()
    taskManager.globalOptions.rawArgs = taskCli.rawArgs
    taskManager.globalOptions.options = options
    // tslint:disable-next-line:no-floating-promises
    taskManager.run(t.name, {
      options,
      rawArgs: taskCli.rawArgs.slice(3),
    })
  })
})

taskCli.on('command:*', () => {
  console.error(`error: Unknown command \`${taskCli.args.join(' ')}\`\n\n`)
  process.exit(1)
})

taskCli.help(sections => {
  if (!taskCli.matchedCommand) {
    let last = sections[sections.length - 1]
    let lines = last.body.split('\n')
    lines.pop()
    last.body =
      lines.concat(
        '  -h, --help                Display this message',
        '  --init, -i [ext]          Generate the Foyfile, <ext> can be "ts" | "js", default is "js"',
        '  --config, -c <...files>   The Foyfiles',
        '  --require, -r <...names>  Require the given modules',
      )
      .join('\n')
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

if (process.argv.length === 2) {
  taskCli.name = pkg.name
  taskCli.outputHelp()
}
