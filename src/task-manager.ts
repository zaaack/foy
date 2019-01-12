import { CliLoading } from './cli-loading';
import { Task } from './task';
import chalk from 'chalk';
import { hashAny, defaults, Is } from './utils';
import { Writable } from 'stream';
import { fs } from './fs';
import { ShellContext } from './exec';
import { logger } from './logger';
import stripAnsi = require('strip-ansi')
import figures = require('figures');

export interface GlobalOptions {
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
  logCommand?: boolean,
  options?: any
  rawArgs?: string[]
  redirectLog?: boolean | string | Writable
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
  asyncDeps: DepsTree[]
  syncDeps: DepsTree[]
  state: TaskState
  depth: number
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
    this.logCommand = defaults(task.logCommand, global.logCommand, true)
  }
  get options() {
    return this.task.options || {} as O
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
  private _tasks: {[k: string]: Task} = {}
  private _didSet: Set<string> = new Set()
  public globalOptions: GlobalOptions = {
    logLevel: 'debug',
    loading: true,
    options: {},
    logCommand: true,
    indent: 4,
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
  // emiter: mitt.Emitter = mitt.call(null)
  resolveDependencyTree(t: Task, depth = 0): DepsTree {
    let asyncDeps: DepsTree[] = []
    let syncDeps: DepsTree[] = []
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
          }
        }
        ;(t.async ? asyncDeps : syncDeps).push(
          this.resolveDependencyTree(t, depth + 1)
        )
      })
    }
    return {
      uid: Date.now().toString(36) + Math.random().toString(36).slice(2),
      task: t,
      asyncDeps,
      syncDeps,
      state: TaskState.waiting,
      depth
    }
  }

  isLoading(t: Task, props: RunTaskOptions) {
    let loading = defaults(props.loading, t.loading, this.globalOptions.loading, true)
    return loading
  }
  async runDepsTree(depsTree: DepsTree, props: RunTaskOptions) {
    let t = depsTree.task
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
      Promise.all(
        depsTree.asyncDeps.map(
          t => this.runDepsTree(t, { ...depProps, parentCtx: ctx })
        )
      ),
    ])

    depsTree.state = TaskState.loading

    if (t.resolveOptions && props.parentCtx) {
      let lazyOptions = await t.resolveOptions(props.parentCtx)
      t.options = {
        ...t.options,
        ...lazyOptions,
      }
    }
    let loading = this.isLoading(t, props)

    let taskHash = hashAny(t)
    if (this._didSet.has(taskHash) && !t.force) {
      depsTree.state = TaskState.skipped
      if (!loading) {
        console.log(chalk.yellow(`Skip task: `) + t.name)
      }
      return
    }

    if (!loading) {
      console.log(chalk.yellow('Task: ') + t.name)
      let ret = t.fn && await t.fn(ctx)
      this._didSet.add(taskHash)
      return ret
    }
    try {
      let ret = t.fn && await t.fn(ctx)
      depsTree.state = TaskState.succeeded
      this._didSet.add(taskHash)
      return ret
    } catch (error) {
      depsTree.state = TaskState.failed
      throw error
    }
  }
  async run(name: string | Task = 'default', props?: RunTaskOptions) {
    const { redirectLog } = this.globalOptions
    if (redirectLog) {
      let stream: Writable
      if (Is.str(redirectLog)) {
        stream = fs.createWriteStream(redirectLog)
      } else if (Is.bool(redirectLog)) {
        stream = fs.createWriteStream(`foy.log`)
      } else {
        stream = redirectLog
      }
      process.stdout.write = (buf: string | Buffer, encoding, ...args) => {
        if (buf instanceof Buffer) {
          buf = buf.toString(Is.str(encoding) ? encoding : 'utf-8')
        }
        buf = stripAnsi(buf)
        return stream.write(buf, encoding, ...args)
      }
    }
    props = {
      options: null,
      parentCtx: null,
      rawArgs: [],
      force: false,
      ...props,
    }
    this._tasks.all = this._tasks.all || await import('./task').then(e => e.task('all', Object.keys(this._tasks)))
    this._tasks.default = this._tasks.default || this._tasks.all

    if (!this._tasks[
      Is.str(name)
        ? name
        : name.name
    ]) {
      throw new TypeError(`Cannot find task with name [${name}]`)
    }
    const t = {
      ...(Is.str(name)
      ? this._tasks[name]
      : name),
      force: props.force,
    }
    t.options = {
      ...(t.options || null),
      ...(props.options || null),
    }
    let depsTree = this.resolveDependencyTree(t)
    let loading = this.isLoading(t, props)
    // await this.renderDepsTree(depsTree, props)
    let cliLoading = new CliLoading({ depsTree })
    if (loading) {
      cliLoading.start()
    } else {
      cliLoading.props.symbolMap = { [TaskState.waiting]: figures.line }
      cliLoading.props.grayState = []
      console.log('\n' + chalk.yellow(`DependencyGraph for task [${t.name}]:\n`))
      console.log(cliLoading.renderDepsTree(depsTree).join('\n') + '\n\n')
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

const TMKey = '@foyjs/taskManager'
/** @internal */
export function getGlobalTaskManager() {
  let taskManager: TaskManager = global[TMKey] = global[TMKey] || new TaskManager()
  return taskManager
}
