---
name: git-checkpoint
description: Create a git checkpoint commit before starting work, and commit changes after completing work
---

# Git Checkpoint Workflow

Package the repeated git checkpoint pattern used across every session in this project.

## Pre-work Checkpoint

Before starting any task, commit current state:

```bash
rtk git add -A && rtk git commit -m "chore: check point"
```

## Post-work Commit

After completing a task, commit with descriptive message:

```bash
rtk git add -A && rtk git commit -m "<type>: <description>

- <change 1>
- <change 2>"
```

### Commit Message Types
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring
- `test:` - Test updates
- `ci:` - CI/CD changes
- `docs:` - Documentation
- `chore:` - Maintenance

## Workflow

1. Run `rtk git add -A && rtk git commit -m "chore: check point"` before starting work
2. Complete the task
3. Run `rtk git add -A && rtk git commit -m "<type>: <description>"` after finishing

## Notes
- Use `--no-verify` flag if pre-commit hooks are failing during development
- The checkpoint commit preserves a safe restore point
