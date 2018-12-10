const ora = require('ora')
import chalk from 'chalk'
import { OptionConfig } from 'cac/types/Option'
import { ShellContext } from './exec'
import { hashAny } from './utils'
import { fs } from './fs';
import { logger } from './logger';

export interface GlobalOptions {
  /**
   * @default true
   */
  loading?: boolean
  /**
   * @description Whether task options only allow defined options, default false
   * @default false
   */
  strict?: boolean
  /**
   * @description log level
   * @default 'debug'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
  options?: any
  rawArgs?: string[]
}

export type OptionDef = [string, string, OptionConfig | undefined]

export type TaskFn<O> = (ctx: TaskContext<O>) => void | Promise<void>
export interface TaskDep<O = any> {
  name: string
  /**
   * Dependences are executed serially by default.
   * If order doesn't matter and you want better performance via parallel, you can mark it as asynchronized.
   */
  async?: boolean
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
export type Dependency = TaskDep | string
export interface Task<O = any> extends TaskDep<O> {
  /** @internal */
  optionDefs?: OptionDef[]
  dependencies?: TaskDep[]
  desc?: string
  fn?: (ctx: TaskContext<O>) => (void | Promise<void>)
  /**
   * Raw arg strings
   */
  rawArgs?: string[]
  /**
   * @description Whether task options only allow defined options, default false
   * @default false
   */
  strict?: boolean
  options: O
}

export class TaskContext<O = any> extends ShellContext {
  fs = fs
  debug = logger.debug
  info = logger.info
  log = logger.log
  warn = logger.warn
  error = logger.error
  constructor(
    public task: Task<O>,
    public global: GlobalOptions
  ) {
    super()
  }
  get options() {
    return this.task.options || {} as O
  }
}

export interface RunTaskOptions {
  options?: any
  rawArgs?: string[]
  parentCtx?: TaskContext | null
  force?: boolean
}
export class TaskManager {
  private _tasks: {[k: string]: Task} = {}
  private _didSet: Set<string> = new Set()
  public globalOptions: GlobalOptions = {
    logLevel: 'debug',
    loading: true,
    options: {},
  }
  getTasks() {
    return Object.keys(this._tasks)
      .map(k => this._tasks[k])
  }
  addTask(task: Task) {
    if (this._tasks[task.name]) {
      throw new TypeError(`Task name [${task.name}] already exists, please choose another task name!`)
    }
    this._tasks[task.name] = task
    return task
  }
  async run(name: string | Task = 'default', props?: RunTaskOptions) {
    props = {
      options: null,
      parentCtx: null,
      rawArgs: [],
      force: false,
      ...props,
    }
    this._tasks.all = this._tasks.all || task('all', Object.keys(this._tasks))
    this._tasks.default = this._tasks.default || this._tasks.all
    if (!this._tasks[
      typeof name === 'string'
        ? name
        : name.name
    ]) {
      throw new TypeError(`Cannot find task with name [${name}]`)
    }
    const t = {
      ...(typeof name === 'string'
      ? this._tasks[name]
      : name),
      force: props.force,
    }
    t.options = {
      ...(t.options || null),
      ...(props.options || null),
    }
    let ctx = new TaskContext(t, this.globalOptions)
    if (t.dependencies) {
      let asyncDeps: Task[] = []
      let syncDeps: Task[] = []
      t.dependencies.forEach(taskDep => {
        let fullTask = this._tasks[taskDep.name]
        if (!fullTask) {
          throw new TypeError(`Cannot find task with name [${fullTask.name}]`)
        }
        const t = {
          ...fullTask,
          async: taskDep.async,
          force: taskDep.force,
          options: {
            ...fullTask.options,
            ...taskDep.options,
          }
        }
        if (t.async) {
          asyncDeps.push(t)
        } else {
          syncDeps.push(t)
        }
      })
      await Promise.all([
        (async () => {
          for (const t of syncDeps) {
            await this.run(t, { parentCtx: ctx })
          }
        })(),
        Promise.all(
          asyncDeps.map(
            t => this.run(t, { parentCtx: ctx })
          )
        ),
      ])
    }
    let ld
    let text = `${t.name}`
    t.rawArgs = props.rawArgs
    if (t.resolveOptions && props.parentCtx) {
      let lazyOptions = await t.resolveOptions(props.parentCtx)
      t.options = {
        ...t.options,
        ...lazyOptions,
      }
    }
    let taskHash = hashAny(t)
    if (this._didSet.has(taskHash) && !t.force) return
    if (!ctx.global.loading) {
      console.log(chalk.yellow('Task: ') + t.name)
      let ret = t.fn && await t.fn(ctx)
      this._didSet.add(taskHash)
      return ret
    }
    ld = ora({
      text: chalk.gray(text),
    }).start()
    try {
      let ret = await (t.fn && t.fn(ctx))
      ld.succeed(text)
      this._didSet.add(taskHash)
      return ret
    } catch (error) {
      ld.fail(chalk.redBright(text))
      throw error
    }
  }
}

const taskManager = new TaskManager()
const TMKey = '@foyjs/taskManager'
/** @internal */
export function getGlobalTaskManager(): TaskManager {
  return (global as any)[TMKey] as any
}
(global as any)[TMKey] = taskManager
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
export function setOption(options: typeof TaskOptions.last) {
  Object.assign(TaskOptions.last, options)
}
export function task<O>(
  name: string,
  fn: TaskFn<O>,
): Task<O>
export function task<O>(
  name: string,
  dependencies: Dependency[],
  fn?: TaskFn<O>,
): Task<O>
/**
 * Define a task
 * @param name
 * @param dependencies
 * @param fn
 */
export function task<O>(
  name: string,
  dependencies?: (Dependency[] | TaskFn<any>),
  fn?: TaskFn<O>,
): Task<O> {
  if (typeof dependencies === 'function') {
    fn = dependencies
    dependencies = []
  }
  const t: Task = {
    name,
    options: {},
    optionDefs: TaskOptions.last.optionDefs,
    desc: TaskOptions.last.desc,
    strict: TaskOptions.last.strict,
    dependencies: (dependencies || []).map(d => {
      if (typeof d === 'string') {
        return { name: d, options: {} } as Task
      }
      return d
    }),
    fn,
  }
  TaskOptions.last = TaskOptions.empty()
  taskManager.addTask(t)
  return t
}
