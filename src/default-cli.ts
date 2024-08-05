import cac, { CAC } from 'cac'
import { fs } from './fs'
import pathLib from 'path'
import os from 'os'
import { logger } from './logger'
import { Is } from './utils'
import { getGlobalTaskManager } from './task-manager'

export const defaultCli = cac()
// generate default argv because cac cannot handle `foy command` + `foy options`
function generateArgv() {
  let defaultArgv: string[] = []
  let taskArgv: string[] = []
  const argv = process.argv.slice(2)
  const defaultOptions = new Map<string, number>([
    ['--config', 1],
    ['-c', 1],
    ['--require', 1],
    ['-r', 1],
    ['--init', 1],
    ['-i', 1],
    ['--completion', 1],
    ['--completion-profile', 0],
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
  defaultArgv = process.argv.slice(0, 2).concat(defaultArgv)
  taskArgv = process.argv.slice(0, 2).concat(taskArgv)
  return [defaultArgv, taskArgv]
}
const [defaultArgv, taskArgv] = generateArgv()

// parse default options
const defaultOptions = [
  [`--config, -c <...files>`, 'The Foyfiles'],
  [`--require, -r <...names>`, 'Require the given modules'],
  [`--init, -i [ext]`, 'Generate the Foyfile, [ext] can be "ts" | "js", default is "js"'],
  [`--completion [val]`, `Generate completion words`],
  [`--completion-profile`, `Generate completion shell profile`],
]
defaultOptions.forEach(([name, desc]) => {
  defaultCli.option(name, desc)
})
defaultCli.parse(defaultArgv)

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
  fs.writeFileSync(
    file,
    `${
      ext === 'js'
        ? `const { task, desc, option, fs } = require('foy')`
        : `import { task, desc, option, fs } from 'foy'`
    }

  task('build', async ctx => {
    // Your build tasks
    await ctx.exec('tsc')
  })

  `,
  )
  process.exit()
} else if (defaultCli.options.completionProfile) {
  console.log(`
###-begin-foy-completions-###
#
# foy command completion script
#
# Installation: foy --completion-profile >> ~/.bashrc
#    or foy --completion-profile >> ~/.zshrc

complete -F _foy_complete_func foy

_foy_complete_func()
{
    local cur opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    opts="$(node ./lib/cli.ts --completion "\${COMP_WORDS[COMP_CWORD-1]}")"

    if [[ \${cur} == * ]] ; then
        COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
        return 0
    fi
}
###-end-foy-completions-###
  `)
  process.exit()
}

function arrify(arr: any | any[]) {
  if (!Array.isArray(arr)) {
    return arr == null ? [] : [arr]
  }
  return arr
}

let foyFiles: string[] = arrify(defaultCli.options.config)
let registers: string[] = arrify(defaultCli.options.require)

if (foyFiles.length) {
  foyFiles = foyFiles.map((c) => pathLib.resolve(process.cwd(), c))
} else {
  // find default foyfiles
  let findFoyfiles = (baseDir: string) => {
    let cwdFoyfiles = fs.readdirSync(baseDir).filter((f) => f.startsWith('Foyfile.'))
    if (cwdFoyfiles.length) {
      if (cwdFoyfiles.length > 1) {
        logger.warn(
          `Find more than 1 Foyfile in current directory, only first one will be used: \n${cwdFoyfiles.join(
            '\n',
          )}`,
        )
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
// check custom foyfiles exists
for (const file of foyFiles) {
  if (!fs.existsSync(file)) {
    throw new TypeError(`Cannot find Foyfile: ${file}`)
  }
}
// add custom registers
if (registers.length) {
  for (let mod of registers) {
    try {
      require(mod)
    } catch (error) {
      require(pathLib.resolve(process.cwd(), mod))
    }
  }
}

// add ts-node registry for ts foyfile
function isESM() {
  try {
    let pkg = fs.readJsonSync('./package.json')
    return pkg.type === 'module'
  } catch (e) {
    return false
  }
}
try {
  if (foyFiles.some((f) => f.endsWith('.ts')) && !require.extensions['.ts']) {
    let options = {
      transpileOnly: true,
      compilerOptions: {
        module:  'commonjs',
      },
    }
    require('ts-node').register(options)
  }
} catch (error) {
  // ignore
}

{
  // Add global installed foy to module.paths if using global foy
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

export const loadConfigPromises:Promise<any>[]=[]
// load foyfiles
for (const file of foyFiles) {
  if (isESM()) {
    loadConfigPromises.push(import(file))
  } else {
    require(file)
  }
}

export const defaultHelpMsg = defaultOptions
  .map(
    ([name, desc]) =>
      `  ${name}:${Array(30 - name.length)
        .fill(' ')
        .join('')}${desc}`,
  )
  .join('\n')
export { taskArgv }

export function outputCompletion(taskCli: CAC) {
  let completVal = defaultCli.options.completion
  if (!completVal) return
  if (completVal === 'foy') {
    completVal = ''
  }
  function getOptionComplets(cmd: string) {
    return taskCli.commands
      .find((c) => c.name === cmd)
      ?.options?.map((o) => '--' + o.name)
      .join(' ')
  }
  const cmdComplets = taskCli.commands.map((c) => c.name)
  // .concat(defaultOptions.map((d) => d[0].split(/[,\s]/)[0]).filter(v => !v.includes('completion')))
  if (completVal && cmdComplets.includes(completVal)) {
    console.log(getOptionComplets(completVal))
  } else {
    console.log(cmdComplets.join(' '))
  }
  process.exit()
}
