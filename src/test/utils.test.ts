import { task } from '../task'
import { fs } from '../fs'
import { exec } from '../exec'
import * as path from 'path'
import { hashAny } from '../utils'

describe('utils', function() {
  it('hashAny', () => {
    expect(hashAny('aa')).toEqual('📝aa')
    expect(hashAny(1)).toEqual('1')
    expect(hashAny(null)).toEqual('null')
    expect(hashAny(undefined)).toEqual('undefined')
    let fn = f => f
    expect(hashAny(fn)).toEqual(hashAny(fn))
    expect(hashAny(fn)).toEqual('⭕️1')
    expect(hashAny(fn)).not.toEqual(hashAny(f => f))
    class A {}
    expect(hashAny({ aa: fn, bb: new A() })).toEqual('Object{"aa":"⭕️1","bb":"A{}"}')
    expect(hashAny({ aa: fn })).toEqual('Object{"aa":"⭕️1"}')
    expect(hashAny({ aa: fn })).toEqual(hashAny({ aa: fn }))
    expect(hashAny({ aa: fn })).not.toEqual(hashAny({ aa: f => f }))
  })

})
