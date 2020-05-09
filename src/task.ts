import chalk from 'chalk'
import { OptionConfig } from 'cac/types/Option'
import { ShellContext } from './exec'
import { hashAny, Is, defaults } from './utils'
import { fs } from './fs'
import { logger } from './logger'
import { CliLoading } from './cli-loading'
import { DepBuilder } from './dep-builder'
import { GlobalOptions, RunTaskOptions, getGlobalTaskManager, TaskContext, LogOptions, ListenerNames } from './task-manager'

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
  namespaces: string[]
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
  logger?: LogOptions
}

/**
 * Set global options for all tasks.
 * @param options
 */
export function setGlobalOptions(options: GlobalOptions) {
  Object.assign(getGlobalTaskManager().globalOptions, options)
}
function appendCallback<Fn extends ((...args) => void | Promise<void>)>(name: ListenerNames, fn: Fn) {
  let tm = getGlobalTaskManager()
  tm.listeners[name].push({
    namespaces: tm.namespaces,
    fn,
  })
}
export const before = (fn: (t: Task) => void | Promise<void>) => appendCallback('before', fn)
export const after = (fn: (t: Task) => void | Promise<void>) => appendCallback('after', fn)
export const onerror = (fn: (err: Error, t: Task) => void | Promise<void>) => appendCallback('onerror', fn)

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

/**
 * Define task description
 * @param desc
 */
export function desc(desc: string) {
  TaskOptions.last.desc = desc
}
/**
 * Define a task cli option
 * @param rawName
 * @param description
 * @param config
 */
export function option(rawName: string, description: string, config?: OptionConfig) {
  TaskOptions.last.optionDefs.push([rawName, description, config])
}
/**
 * Define task cli options are strict, which means it will throw an error if you passed undefined options.
 */
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
  dependencies: Dependency[] | TaskFn<any> = [],
  fn?: TaskFn<O>,
): Task<O> {
  if (Is.fn(dependencies)) {
    fn = dependencies
    dependencies = []
  }
  const namespaces = getGlobalTaskManager().namespaces
  if (namespaces.length) {
    name = `${namespaces.join(':')}:${name}`
  }
  const t: Task = {
    name,
    namespaces,
    options: {},
    optionDefs: TaskOptions.last.optionDefs,
    desc: TaskOptions.last.desc,
    strict: TaskOptions.last.strict,
    loading: TaskOptions.last.loading,
    rawArgs: [],
    dependencies: dependencies.map(d => {
      if (Is.str(d)) {
        return { name: d, options: {} } as Task
      } else if (d._isDepBuilder) {
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

/**
 * Create namespace prefix for inner tasks
 * @param ns namespace
 * @param fn
 * @example
 * namespace('client', ns => {
 *   task('run', async ctx => {
 *     logger.log(ns) // 'client'
 *     await ctx.exec('<run cmd>')
 *   })
 * })
 * namespace('server', ns => {
 *   task('run', async ctx => {
 *     logger.log(ns) // 'server'
 *     await ctx.exec('<run cmd>')
 *   })
 * })
 *
 * ==========
 * $ yarn foy client:run
 * $ yarn foy server:run
 */
export function namespace(ns: string, fn: (ns: string) => void) {
  const tm = getGlobalTaskManager()
  tm.namespaces = tm.namespaces.concat(ns)
  fn(ns)
  tm.namespaces = tm.namespaces.slice(0, -1)
}
