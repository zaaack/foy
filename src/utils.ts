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
