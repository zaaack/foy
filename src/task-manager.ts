import { CliLoading } from './cli-loading'
import { Task } from './task'
import chalk from 'chalk'
import { hashAny, defaults, Is, DefaultLogFile } from './utils'
import { Writable, Stream } from 'stream'
import { fs } from './fs'
import { ShellContext } from './exec'
import { logger, ILogInfo } from './logger'
import figures = require('figures')

export interface GlobalOptions {
  /**
   * Before all tasks
   */
  before?: () => void | Promise<void>
  /**
   * After all tasks
   */
  after?: () => void | Promise<void>
  /**
   * Handle error
   */
  onerror?: (err: Error) => void | Promise<void>
  /**
   * @default true
   */
  loading?: boolean
  indent?: number
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
  /**
   * @description whether log command when execute command
   * @default true
   */
  logCommand?: boolean
  onLog?: (info: ILogInfo) => void
  options?: any
  rawArgs?: string[]
}

export interface RunDepOptions {
  rawArgs?: string[]
  parentCtx?: TaskContext | null
  /** default is false */
  loading?: boolean
  indent?: number
}

export interface RunTaskOptions extends RunDepOptions {
  options?: any
  rawArgs?: string[]
  parentCtx?: TaskContext | null
  force?: boolean
}

export enum TaskState {
  waiting = 'waiting',
  pending = 'pending',
  skipped = 'skipped',
  loading = 'loading',
  succeeded = 'succeeded',
  failed = 'failed',
}

export interface DepsTree {
  uid: string
  task: Task
  asyncDeps: DepsTree[][]
  syncDeps: DepsTree[]
  state: TaskState
  depth: number
  priority: number
}

export class TaskContext<O = any> extends ShellContext {
  fs = fs
  debug = logger.debug
  info = logger.info
  log = logger.log
  warn = logger.warn
  error = logger.error
  constructor(public task: Task<O>, public global: GlobalOptions) {
    super()
    this.logCommand = defaults(task.logCommand, global.logCommand, true)
  }
  get options() {
    return this.task.options || ({} as O)
  }

  run(task: string | Task, options?: RunTaskOptions) {
    return getGlobalTaskManager().run(task, {
      force: true,
      loading: false,
      ...options,
    })
  }
}

export class TaskManager {
  private _tasks: { [k: string]: Task } = {}
  private _didMap: Map<string, Promise<any>> = new Map()
  public globalOptions: GlobalOptions = {
    logLevel: 'debug',
    loading: true,
    options: {},
    logCommand: true,
    indent: 3,
  }
  getTasks() {
    return Object.keys(this._tasks).map(k => this._tasks[k])
  }
  addTask(task: Task) {
    if (this._tasks[task.name]) {
      throw new TypeError(
        `Task name [${task.name}] already exists, please choose another task name!`,
      )
    }
    this._tasks[task.name] = task
    return task
  }
  resolveDependencyTree(t: Task, depth = 0): DepsTree {
    let asyncDeps: DepsTree[][] = []
    let syncDeps: DepsTree[] = []
    let asyncDepsMap: {[k: number]: DepsTree[]} = {}
    if (t.async === true) {
      t.async = 0
    }
    if (t.dependencies) {
      t.dependencies.forEach(taskDep => {
        let fullTask = this._tasks[taskDep.name]
        if (!fullTask) {
          throw new TypeError(`Cannot find task with name [${taskDep.name}]`)
        }
        const t: Task = {
          ...fullTask,
          ...taskDep,
          options: {
            ...fullTask.options,
            ...taskDep.options,
          },
        }
        let depTask = this.resolveDependencyTree(t, depth + 1)
        if (t.async === false || !Is.defed(t.async)) { // sync tasks
          syncDeps.push(depTask)
        } else {
          let idx = t.async === true ? 0 : t.async
          let deps = asyncDepsMap[idx] = asyncDepsMap[idx] || []
          deps.push(depTask)
        }
      })
      asyncDeps = []
      Object.keys(asyncDepsMap)  // Sort async deps via priority, bigger is former
      .map(Number)
      .sort((a, b) => b - a)
      .map(k => (asyncDeps.push(asyncDepsMap[k])))
    }
    return {
      uid:
        Date.now().toString(36) +
        Math.random()
          .toString(36)
          .slice(2),
      task: t,
      asyncDeps,
      syncDeps,
      state: TaskState.waiting,
      depth,
      priority: Is.num(t.async) ? t.async : 0,
    }
  }

  isLoading(t: Task, props: RunTaskOptions) {
    return defaults(props.loading, t.loading, this.globalOptions.loading, true)
  }
  async runDepsTree(depsTree: DepsTree, props: RunTaskOptions) {
    let t = depsTree.task
    let taskHash = hashAny(t)
    let loading = this.isLoading(t, props)

    let didResolved = null as (() => void) | null
    if (this._didMap.has(taskHash) && !t.force) {
      depsTree.state = TaskState.skipped
      await this._didMap.get(taskHash)
      if (!loading) {
        console.log(chalk.yellow(`Skip task: `) + t.name)
      }
      return
    }
    this._didMap.set(taskHash, new Promise(res => (didResolved = res)))

    t.rawArgs = props.rawArgs || []
    const ctx = new TaskContext(t, this.globalOptions)
    const depProps: RunDepOptions = {
      rawArgs: props.rawArgs,
      indent: props.indent,
      loading: props.loading,
      parentCtx: ctx,
    }

    depsTree.state = TaskState.pending
    await Promise.all([
      (async () => {
        for (const t of depsTree.syncDeps) {
          await this.runDepsTree(t, { ...depProps, parentCtx: ctx })
        }
      })(),
      (async () => {
        for (const deps of depsTree.asyncDeps) {
          await Promise.all(
            deps.map(t => this.runDepsTree(t, { ...depProps, parentCtx: ctx })),
          )
        }
      })(),
    ])

    depsTree.state = TaskState.loading

    if (t.resolveOptions && props.parentCtx) {
      let lazyOptions = await t.resolveOptions(props.parentCtx)
      t.options = {
        ...t.options,
        ...lazyOptions,
      }
    }

    if (!loading) {
      console.log(chalk.yellow('Task: ') + t.name)
      let retPromise = t.fn && t.fn(ctx)
      didResolved && didResolved()
      return retPromise
    }

    try {
      let ret = t.fn && (await t.fn(ctx))
      depsTree.state = TaskState.succeeded
      didResolved && didResolved()
      return ret
    } catch (error) {
      depsTree.state = TaskState.failed
      throw error
    }
  }
  async run(name: string | Task = 'default', props?: RunTaskOptions) {
    logger._props.onLog = this.globalOptions.onLog
    props = {
      options: null,
      parentCtx: null,
      rawArgs: [],
      force: false,
      ...props,
    }
    this._tasks.all =
      this._tasks.all || (await import('./task').then(e => e.task('all', Object.keys(this._tasks))))
    this._tasks.default = this._tasks.default || this._tasks.all

    if (!this._tasks[Is.str(name) ? name : name.name]) {
      throw new TypeError(`Cannot find task with name [${name}]`)
    }
    const t = {
      ...(Is.str(name) ? this._tasks[name] : name),
      force: props.force,
    }
    t.options = {
      ...(t.options || null),
      ...(props.options || null),
    }
    let depsTree = this.resolveDependencyTree(t)
    let loading = this.isLoading(t, props)
    let cliLoading = new CliLoading({
      depsTree,
      indent: defaults(props.indent, this.globalOptions.indent),
    })
    if (loading) {
      cliLoading.start()
    } else {
      cliLoading.props.symbolMap = { [TaskState.waiting]: figures.line }
      cliLoading.props.grayState = []
      console.log(chalk.yellow(`DependencyGraph for task [${t.name}]:`))
      console.log(cliLoading.renderDepsTree(depsTree).join('\n') + '\n')
    }
    try {
      let ret = await this.runDepsTree(depsTree, props)
      return ret
    } finally {
      if (loading) {
        cliLoading.stop()
      }
    }
  }
}

const TMKey = '@foy/taskManager'
/** @internal */
export function getGlobalTaskManager() {
  let taskManager: TaskManager = (global[TMKey] = global[TMKey] || new TaskManager())
  return taskManager
}
