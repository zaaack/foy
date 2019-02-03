import { join } from 'path'

let objUid = 0
let objUidMap = new WeakMap<object, number>()
/** @internal */
export function getType(key: any) {
  const t: string = Object.prototype.toString.call(key)
  return t.slice(8, -1).toLowerCase()
}
/** @internal */
export function hashAny(key: any) {
  switch (getType(key)) {
    case 'undefined':
    case 'null':
    case 'boolean':
    case 'number':
    case 'regexp':
      return key + ''

    case 'date':
      return '📅' + key.getTime()

    case 'string':
      return '📝' + key

    case 'array':
      return '🔗' + (key as any[]).map(k => hashAny(k)).join('⁞')
    case 'object':
      return key.constructor.name + JSON.stringify(key, (k, v) => {
        if (!k) return v
        return hashAny(v)
      })
    default:
      let uid = objUidMap.get(key)
      if (!uid) {
        uid = ++objUid
        objUidMap.set(key, uid)
      }
      return '⭕️' + uid
  }
}

export const sleep = (ms: number) => {
  return new Promise<void>(res => setTimeout(res, ms))
}

export function throttle<T extends (...args: any[]) => void>(cb: T, ms: number): T {
  let timer
  let newCb = (...args) => {
    timer && clearTimeout(timer)
    timer = setTimeout(cb, ms, ...args)
  }
  return newCb as any
}

export const Is = {
  defed<T>(v: T | null | undefined): v is T {
    return typeof v !== 'undefined' && v !== null
  },
  str(v: any): v is string {
    return typeof v === 'string'
  },
  bool(v: any): v is boolean {
    return typeof v === 'boolean'
  },
  fn(v: any): v is Function {
    return typeof v === 'function'
  },
  obj(v: any): v is object {
    return v && typeof v === 'object'
  },
  num(v: any): v is number {
    return typeof v === 'number'
  },
  arr<T>(v: T | T[]): v is T[] {
    return Array.isArray(v)
  }
}

export function defaults<T>(val: T | undefined, defaultVal: T): T
export function defaults<T>(val: T | undefined, val1: T | undefined, defaultVal: T): T
export function defaults<T>(val: T | undefined, val1: T | undefined, val2: T | undefined, defaultVal: T): T
export function defaults<T>(val: T | undefined, val1: T | undefined, val2: T | undefined, val3: T | undefined, defaultVal: T): T
export function defaults<T>(val: T | undefined, val1: T | undefined, val2: T | undefined, val3: T | undefined, val4: T | undefined, defaultVal: T): T
export function defaults<T>(...args: (T | undefined)[]): T {
  let [val, ...defaultVals] = args
  if (Is.defed(val)) return val
  if (defaultVals.length === 0) {
    return val as any
  }
  return (defaults as any)(...defaultVals)
}

export type Stringify<T> = {
  [k in keyof T]: T[k] extends (string | null | undefined | 0 | false) ? string : Stringify<T[k]>
}

const nsSet = new Set()

/**
 * Generate unique task names with namespaces via object tree.
 * @param obj
 * @param ns Namespace
 * @param sep Separator for namespaces
 * @example
 *  ```ts
 * /** N.aa.bb => 'aa:bb' *\/
 * const N = namespacify({
 *   aa: { bb: { cc: '' } },
 *   cc: '',
 *   ff: ''
 * })
 *
 * /* =>
 *    { aa: { bb: { cc: 'aa:bb:cc' } },
 *      cc: 'cc',
 *      ff: 'ff' } *\/
 *  ```
 */
export function namespacify<T>(obj: T, ns = '', sep = ':'): Stringify<T> {
  if (nsSet.has(obj)) return obj as any
  for (const key in obj) {
    const val = obj[key] || key
    if (Is.str(val)) {
      obj[key] = `${ns}${ns && sep}${val}` as any
    } else if (Is.obj(val)) {
      namespacify(val, `${ns}${ns && sep}${key}`, sep)
    }
  }
  nsSet.add(obj)
  return obj as any
}

export function namespace<T>(ns: T, fn: (ns: Stringify<T>) => void) {
  fn(namespacify(ns))
}

export const DefaultLogFile = join(process.cwd(), 'foy.log')
