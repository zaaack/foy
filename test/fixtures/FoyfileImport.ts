import { task, desc, setGlobalOptions } from '../../src/task'
import './tasks-imported'

setGlobalOptions({ spinner: false })

desc('local task X')
task('local-x', async () => {})

desc('local task Y')
task('local-y', async () => {})
