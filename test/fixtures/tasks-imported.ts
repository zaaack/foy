import { task, desc } from '../../src/task'

// Register many tasks to widen the race window for deferRunCli
for (let i = 0; i < 50; i++) {
  desc(`imported task ${i}`)
  task(`imported-${i}`, async () => {})
}
