import { task } from '../src/task'
import { fs } from '../src/fs'
import { exec } from '../src/exec'
import * as path from 'path'
import { hashAny } from '../src/utils'
import { describe, it, before, beforeEach } from 'node:test'
import { equal, notEqual, strictEqual } from 'assert'

describe('utils', function() {
  it('hashAny', () => {
    equal(hashAny('aa'),'📝aa')
    equal(hashAny(1), '1')
    equal(hashAny(null), 'null')
    equal(hashAny(undefined), 'undefined')
    let fn = f => f
    equal(hashAny(fn),hashAny(fn))
    equal(hashAny(fn),'⭕️1')
    notEqual(hashAny(fn), hashAny(f => f))
    class A {}
    equal(hashAny({ aa: fn, bb: new A() }),'Object{"aa":"⭕️1","bb":"A{}"}')
    equal(hashAny({ aa: fn }),'Object{"aa":"⭕️1"}')
    equal(hashAny({ aa: fn }),hashAny({ aa: fn }))
    notEqual(hashAny({ aa: fn }), hashAny({ aa: f => f }))
  })

})
