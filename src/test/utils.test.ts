import { task } from '../task'
import { fs } from '../fs'
import { exec } from '../exec'
import * as path from 'path'
import * as assert from 'assert'
import { hashAny, namespacify } from '../utils'

describe('utils', function() {
  it('hashAny', () => {
    assert.strictEqual(hashAny('aa'), '📝aa')
    assert.strictEqual(hashAny(1), '1')
    assert.strictEqual(hashAny(null), 'null')
    assert.strictEqual(hashAny(undefined), 'undefined')
    let fn = f => f
    assert.strictEqual(hashAny(fn), hashAny(fn))
    assert.strictEqual(hashAny(fn), '⭕️1')
    assert.notStrictEqual(hashAny(fn), hashAny(f => f))
    class A {}
    assert.strictEqual(hashAny({ aa: fn, bb: new A() }), 'Object{"aa":"⭕️1","bb":"A{}"}')
    assert.strictEqual(hashAny({ aa: fn }), 'Object{"aa":"⭕️1"}')
    assert.strictEqual(hashAny({ aa: fn }), hashAny({ aa: fn }))
    assert.notStrictEqual(hashAny({ aa: fn }), hashAny({ aa: f => f }))
  })

  it('namespacify', async () => {
    let a = namespacify({
      aa: { bb: { cc: '123', dd: null }, cc: '123', dd: null },
      cc: 'dd',
      ff: '123',
      dd: null,
    })

    assert.deepStrictEqual(a, {
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

    assert.deepStrictEqual(
      namespacify({ aa: null, bb: { cc: null } }, 'prefix', '|'),
      { aa: 'prefix|aa', bb: { cc: 'prefix|bb|cc' } }
    )
  })
})
