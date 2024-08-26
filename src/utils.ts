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
      return '🔗' + (key as any[]).map((k) => hashAny(k)).join('⁞')
    case 'object':
      return (
        key.constructor.name +
        JSON.stringify(key, (k, v) => {
          if (!k) return v
          return hashAny(v)
        })
      )
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
  return new Promise<void>((res) => setTimeout(res, ms))
}

export function debounce<T extends (...args: any[]) => void>(
  cb: T,
  ms: number,
  getArgsKey: (args: any[]) => string = (args: any[]) => args.join('|'),
): T {
  let timerMap = new Map<string, any>()
  let newCb = (...args) => {
    if (timerMap.size > 20) {
      timerMap = new Map()
    }
    const key = getArgsKey(args)
    let timer = timerMap.get(key)
    timer && clearTimeout(timer)
    timer = setTimeout(cb, ms, ...args)
    timerMap.set(key, timer)
  }
  return newCb as any
}

export function promiseQueue<A extends any[], R>(cb: (...args: A) => Promise<R> | R) {
  let promiseQueue = Promise.resolve(null as any)
  return (...args: A) => {
    promiseQueue = promiseQueue.then(() => cb(...args))
    return promiseQueue
  }
}

export const Is = {
  defined<T>(v: T | null | undefined): v is T {
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
}

export function defaults<T>(val: T | undefined, defaultVal: T): T
export function defaults<T>(val: T | undefined, val1: T | undefined, defaultVal: T): T
export function defaults<T>(
  val: T | undefined,
  val1: T | undefined,
  val2: T | undefined,
  defaultVal: T,
): T
export function defaults<T>(
  val: T | undefined,
  val1: T | undefined,
  val2: T | undefined,
  val3: T | undefined,
  defaultVal: T,
): T
export function defaults<T>(
  val: T | undefined,
  val1: T | undefined,
  val2: T | undefined,
  val3: T | undefined,
  val4: T | undefined,
  defaultVal: T,
): T
export function defaults<T>(...args: (T | undefined)[]): T {
  let [val, ...defaultVals] = args
  if (Is.defined(val)) return val
  if (defaultVals.length === 0) {
    return val as any
  }
  return (defaults as any)(...defaultVals)
}

export const DefaultLogFile = join(process.cwd(), 'foy.log')

export const formatDate = (d: Date) =>
  `${d.getFullYear()}-${
    d.getMonth() + 1
  }-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`

export function formatDuration(ms: number) {
  return Number((ms / 1000).toFixed(2)) + 's'
}
