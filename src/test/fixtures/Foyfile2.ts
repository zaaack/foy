import { task, namespace, before, after, onerror } from "../../task";
import { sleep } from '../../utils';
import { logger } from '../../logger';

before((t) => {
  logger.log('beforeAll', t.name)
})

after((t) => {
  logger.log('afterAll', t.name)
})

onerror((e, t) => {
  logger.log(`onerrorError`, e.message, t.name)
})

task('start', async () => {
  logger.log('start')
})
task('error', async () => {
  logger.log('error')
})
namespace('ns1', ns => {
  before(t => {
    logger.log(`before ${ns}`, t.name)
  })
  after((t) => {
    logger.log(`after ${ns}`, t.name)
  })

  onerror((e, t) => {
    logger.log(`onerror ${ns}`, e.message, t.name)
  })

  task('t1', async ctx => {
    logger.info('t1', 'ns', ns)
  })
  task('error', async ctx => {
    throw new Error('test error')
  })
  namespace('ns2', ns2 => {
    before(t => {
      logger.log(`before ${ns2}`, t.name)
    })
    after((t) => {
      logger.log(`after ${ns2}`, t.name)
    })
    task('t2', async ctx => {
      logger.info('t2', 'ns', ns, ns2)
    })
  })
})

namespace('ns3', ns3 => {
  before(t => {
    logger.log(`before ${ns3}`, t.name)
  })
})
