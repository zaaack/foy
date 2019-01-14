import { task } from '../task'
import { fs } from '../fs'
import { exec } from '../exec'
import * as path from 'path'
import * as assert from 'assert'
import { hashAny, namespacify } from '../utils'

describe('utils', function() {
  it('hashAny', () => {
    assert.equal(hashAny('aa'), '📝aa')
    assert.equal(hashAny(1), '1')
    assert.equal(hashAny(null), 'null')
    assert.equal(hashAny(undefined), 'undefined')
    let fn = f => f
    assert.equal(hashAny(fn), hashAny(fn))
    assert.equal(hashAny(fn), '⭕️1')
    assert.notEqual(hashAny(fn), hashAny(f => f))
    class A {}
    assert.equal(hashAny({ aa: fn, bb: new A() }), 'Object{"aa":"⭕️1","bb":"A{}"}')
    assert.equal(hashAny({ aa: fn }), 'Object{"aa":"⭕️1"}')
    assert.equal(hashAny({ aa: fn }), hashAny({ aa: fn }))
    assert.notEqual(hashAny({ aa: fn }), hashAny({ aa: f => f }))
  })

  it('namespacify', async () => {
    let a = namespacify({
      aa: { bb: { cc: '123', dd: null }, cc: '123', dd: null },
      cc: 'dd',
      ff: '123',
      dd: null,
    })

    assert.deepEqual(a, {
      aa: {
        bb: {
          cc: 'aa:bb:123',
          dd: 'aa:bb:dd',
        },
        cc: 'aa:123',
        dd: 'aa:dd',
      },
      cc: 'dd',
      ff: '123',
      dd: 'dd',
    })

    assert.deepEqual(
      namespacify({ aa: null, bb: { cc: null } }, 'prefix', '|'),
      { aa: 'prefix|aa', bb: { cc: 'prefix|bb|cc' } }
    )
  })
})
