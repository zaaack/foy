const ora = require('ora')
import chalk from 'chalk'
import { OptionConfig } from 'cac/types/Option'
import { ShellContext } from './exec'
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
}

export type OptionDef = [string, string, OptionConfig | undefined]

export type TaskFn<O> = (ctx: TaskContext<O>) => void | Promise<void>
export type Dependency = Task | string
export interface Task<O = any> {
  name: string
  /** @internal */
  optionDefs?: OptionDef[]
  desc?: string
  dependencies?: Task[]
  fn?: (ctx: TaskContext<O>) => (void | Promise<void>)
  /**
   * Dependences are executed serially by default.
   * If order doesn't matters and you want better performance via parallel, you can mark it as asynchronized.
   */
  async?: boolean
  /**
   * Whether rerun it when it occured in dependences tree more then once.
   */
  force?: boolean
  /** @internal */
  did?: boolean
  /**
   * Parsed options
   */
  options: O
  /**
   * Raw arg strings
   */
  args?: string[]
  /**
   * @description Whether task options only allow defined options, default false
   * @default false
   */
  strict?: boolean
}

export class TaskContext<O = any> extends ShellContext {
  constructor(
    public task: Task<O>,
    public globalOptions: GlobalOptions
  ) {
    super()
  }
  get options() {
    return this.task.options || {} as O
  }
}

export class TaskManager {
  private _tasks: {[k: string]: Task} = {}
  public globalOptions: GlobalOptions = {
    logLevel: 'debug',
    loading: true,
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
  async run(name = 'default', {
    options = null,
    args = [] as string[]
  }) {
    this._tasks.all = this._tasks.all || task('all', Object.keys(this._tasks))
    this._tasks.default = this._tasks.default || this._tasks.all
    const t = this._tasks[name]
    if (!t) {
      throw new TypeError(`Cannot find task with name [${name}]`)
    }
    if (t.dependencies) {
      let asyncDeps: Task[] = []
      let syncDeps: Task[] = []
      t.dependencies.forEach(t => {
        if (t.async) {
          asyncDeps.push(t)
        } else {
          syncDeps.push(t)
        }
      })
      await Promise.all([
        (async () => {
          for (const t of syncDeps) {
            await this.run(t.name, { options: t.options })
          }
        })(),
        Promise.all(asyncDeps.map(t => this.run(t.name, { options: t.options }))),
      ])
    }
    let ld
    let text = `${t.name}`
    t.options = options
    t.args = args
    let ctx = new TaskContext(t, this.globalOptions)
    if (t.did && !t.force) return
    if (!ctx.globalOptions.loading) {
      console.log(chalk.yellow('Task: ') + t.name)
      let ret = t.fn && await t.fn(ctx)
      t.did = true
      return ret
    }
    ld = ora({
      text: chalk.gray(text),
    }).start()
    try {
      let ret = await (t.fn && t.fn(ctx))
      ld.succeed(text)
      t.did = true
      return ret
    } catch (error) {
      ld.fail(chalk.redBright(text))
      throw error
    }
  }
}

const taskManager = new TaskManager()
const TMKey = '@foyjs/taskManager'
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
      d.options = d.options || {}
      return d
    }),
    fn,
  }
  TaskOptions.last = TaskOptions.empty()
  taskManager.addTask(t)
  return t
}
