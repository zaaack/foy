import chalk from 'chalk'
import { OptionConfig } from 'cac/types/Option'
import { ShellContext } from './exec'
import { hashAny, Is, defaults } from './utils'
import { fs } from './fs'
import { logger } from './logger'
import { CliLoading } from './cli-loading'
import { DepBuilder } from './dep-builder'
import { GlobalOptions, RunTaskOptions, getGlobalTaskManager, TaskContext } from './task-manager'
import { Writable } from 'stream'

export type OptionDef = [string, string, OptionConfig | undefined]

export type TaskFn<O, T = any> = (ctx: TaskContext<O>) => T | Promise<T>
export interface TaskDep<O = any> {
  name: string
  /**
   * Dependences are executed serially by default.
   * If order doesn't matter and you want better performance via parallel, you can mark it as asynchronized.
   * Asynchronized will run immediately whether there are synchronized tasks before them or not.
   * You can pass a number as the priority of asynchronized tasks, bigger is formmer.
   */
  async?: boolean | number
  /**
   * Whether rerun it when it occured in dependences tree more then once.
   */
  force?: boolean
  /**
   * Parsed options
   */
  options?: O
  resolveOptions?: (ctx: TaskContext) => Promise<O> | O
  [k: string]: any
}
export type Dependency = TaskDep | string | DepBuilder
export interface Task<O = any> extends TaskDep<O> {
  /** @internal */
  optionDefs?: OptionDef[]
  dependencies?: TaskDep[]
  desc?: string
  fn?: (ctx: TaskContext<O>) => void | Promise<void>
  /**
   * Raw arg strings
   */
  rawArgs: string[]
  /**
   * @description Whether task options only allow defined options, default false
   * @default false
   */
  strict?: boolean
  options: O
  /**
   * @description whether show loading
   * @default globalOptions.loading
   */
  loading?: boolean
  /**
   * @description whether log executed command
   * @default globalOptions.logCommand
   */
  logCommand?: boolean
  /**
   * @description whether redirect all ctx.exec & ctx.spawn's output to file
   * @default globalOptions.redirectLog
   */
  redirectLog?: boolean | string | Writable
}

/**
 * Set global options for all tasks.
 * @param options
 */
export function setGlobalOptions(options: GlobalOptions) {
  Object.assign(getGlobalTaskManager().globalOptions, options)
}

namespace TaskOptions {
  export let last = empty()
  export function empty() {
    return {
      desc: undefined as undefined | string,
      optionDefs: [] as OptionDef[],
      strict: getGlobalTaskManager().globalOptions.strict,
      loading: undefined as undefined | boolean,
    }
  }
}

export function desc(desc: string) {
  TaskOptions.last.desc = desc
}
export function option(rawName: string, description: string, config?: OptionConfig) {
  TaskOptions.last.optionDefs.push([rawName, description, config])
}
export function strict() {
  TaskOptions.last.strict = true
}
/**
 * Set options for next task.
 * @param options
 */
export function setOption(options: Partial<typeof TaskOptions.last>) {
  Object.assign(TaskOptions.last, options)
}
export function task<O>(name: string, fn: TaskFn<O>): Task<O>
export function task<O>(name: string, dependencies: Dependency[], fn?: TaskFn<O>): Task<O>
/**
 * Define a task
 * @param name
 * @param dependencies
 * @param fn
 */
export function task<O>(
  name: string,
  dependencies: Dependency | Dependency[] | TaskFn<any> = [],
  fn?: TaskFn<O>,
): Task<O> {
  if (Is.fn(dependencies)) {
    fn = dependencies
    dependencies = []
  } else if (!Is.arr(dependencies)) {
    dependencies = [dependencies]
  }
  const t: Task = {
    name,
    options: {},
    optionDefs: TaskOptions.last.optionDefs,
    desc: TaskOptions.last.desc,
    strict: TaskOptions.last.strict,
    loading: TaskOptions.last.loading,
    rawArgs: [],
    dependencies: dependencies.map(d => {
      if (Is.str(d)) {
        return { name: d, options: {} } as Task
      } else if (d instanceof DepBuilder) {
        return d.toTaskDep()
      }
      return d
    }),
    fn,
  }
  TaskOptions.last = TaskOptions.empty()
  getGlobalTaskManager().addTask(t)
  return t
}
