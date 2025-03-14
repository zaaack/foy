import { Dependency, TaskDep } from './task'
import { Is } from './utils'
import { TaskContext } from './task-manager'

export class DepBuilder<O = any> {
  private _dep: TaskDep<O>
  readonly _isDepBuilder = true
  constructor(name: Dependency) {
    if (Is.str(name)) {
      name = { name }
    } else if (name instanceof DepBuilder) {
      name = name.toTaskDep()
    }
    this._dep = name
  }
  /**
   *
   * Dependences are executed serially by default.
   * If order doesn't matter and you want better performance via parallel, you can mark it as asynchronized.
   * Asynchronized will run immediately whether there are synchronized tasks before them or not.
   * You can pass a number as the priority of asynchronized tasks, bigger is formmer.
   * @param priority
   */
  async(priority: number | boolean = true) {
    this._dep.async = priority
    return this
  }
  force() {
    this._dep.force = true
    return this
  }
  options(opts: O | ((ctx: TaskContext) => O)) {
    if (Is.fn(opts)) {
      this._dep.resolveOptions = opts
    } else {
      this._dep.options = opts
    }
    return this
  }
  toTaskDep() {
    return this._dep
  }
}

export function dep(dep: Dependency) {
  if (Is.str(dep)) {
    dep = { name: dep }
  }
  return new DepBuilder(dep)
}

declare global {
  interface String {
    /**
     * Dependences are executed serially by default.
     * If order doesn't matter and you want better performance via parallel, you can mark it as asynchronized.
     * Asynchronized will run immediately whether there are synchronized tasks before them or not.
     * You can pass a number as the priority of asynchronized tasks, bigger is formmer.
     */
    async(priority?: number | boolean): DepBuilder
    force(): DepBuilder
    options<O>(opts: O | NonNullable<TaskDep['resolveOptions']>): DepBuilder
  }
}
