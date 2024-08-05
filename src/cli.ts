#!/usr/bin/env node

import cac from 'cac'
import { fs } from './fs'
import pathLib from 'path'
import os from 'os'
import { logger } from './logger'
import { Is } from './utils'
import { getGlobalTaskManager } from './task-manager'
import chalk from 'chalk'
import { defaultHelpMsg, taskArgv, defaultCli, outputCompletion, loadConfigPromises } from './default-cli'

async function main() {
  if (loadConfigPromises.length) {
    await Promise.all(loadConfigPromises)
  }
  const taskCli = cac()

  let taskManager = getGlobalTaskManager()
  taskManager.getTasks().forEach((t) => {
    let strict = taskManager.globalOptions.strict || t.strict
    let cmd = taskCli.command(t.name, t.desc, { allowUnknownOptions: !strict })
    if (t.optionDefs) {
      t.optionDefs.forEach((def) => cmd.option(...def))
    }
    cmd.action(async (...args) => {
      let options = args.pop()
      let { globalOptions } = taskManager
      globalOptions.rawArgs = taskCli.rawArgs
      globalOptions.options = options
      await taskManager
        .run(t.name, {
          options,
          rawArgs: taskCli.rawArgs.slice(3),
        })
        .catch((err) => {
          logger.error(err)
          throw err
        })
    })
  })

  taskCli.help((sections) => {
    if (!taskCli.matchedCommand) {
      let last = sections[sections.length - 1]
      let lines = last.body.split('\n')
      lines.pop()
      last.body = defaultHelpMsg
    }
    console.log(
      sections
        .map((section) => {
          return section.title ? `${section.title}:\n${section.body}` : section.body
        })
        .join('\n\n'),
    )
    process.exit(0)
  })
  taskCli.parse(taskArgv)

  outputCompletion(taskCli)

  taskCli.on('command:*', () => {
    console.error(`error: Unknown command \`${taskCli.args.join(' ')}\`\n\n`)
    process.exit(1)
  })

  if (process.argv.length === 2) {
    taskCli.outputHelp()
  }
}

main().catch(e => {
  throw e
})
