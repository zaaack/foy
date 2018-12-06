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
