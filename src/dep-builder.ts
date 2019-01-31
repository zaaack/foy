import { Dependency, TaskDep } from './task';
import { Is } from './utils';
import { TaskContext } from './task-manager';

export class DepBuilder<O = any> {
  private _dep: TaskDep<O>
  constructor(name: Dependency) {
    if (Is.str(name)) {
      name = { name }
    } else if (name instanceof DepBuilder) {
      name = name.toTaskDep()
    }
    this._dep = name
  }
  async(async: number | boolean = true) {
    this._dep.async = async
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
    async(async?: number | boolean): DepBuilder
    force(): DepBuilder
    options<O>(opts: O | NonNullable<TaskDep['resolveOptions']>): DepBuilder
  }
}

String.prototype.async = function (async?: number | boolean) {
  return dep(this as string).async(async)
}

String.prototype.force = function () {
  return dep(this as string).force()
}

String.prototype.options = function (opts) {
  return dep(this as string).options(opts)
}
