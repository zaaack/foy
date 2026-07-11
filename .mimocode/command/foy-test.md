---
description: Run pnpm test with optional cache clear and snapshot update
---

# foy-test

Run the test suite with common options for this project.

## Usage

```
foy-test [--clear-cache] [--update-snap]
```

## Options

- `--clear-cache` - Clear `node_modules/.cache/foyCache.json` before running tests
- `--update-snap` - Set `UPDATE_SNAP=1` to update test snapshots

## Examples

```bash
# Basic test run
foy-test

# Clear cache and run tests (use after cache-related changes)
foy-test --clear-cache

# Update snapshots (use when test output format changes)
foy-test --update-snap

# Clear cache and update snapshots
foy-test --clear-cache --update-snap
```

## Implementation

```bash
# Parse arguments
CLEAR_CACHE=false
UPDATE_SNAP=false

for arg in "$@"; do
  case $arg in
    --clear-cache) CLEAR_CACHE=true ;;
    --update-snap) UPDATE_SNAP=true ;;
  esac
done

# Build command
CMD=""
if [ "$CLEAR_CACHE" = true ]; then
  CMD="rm -f node_modules/.cache/foyCache.json && "
fi

if [ "$UPDATE_SNAP" = true ]; then
  CMD="${CMD}UPDATE_SNAP=1 pnpm test"
else
  CMD="${CMD}pnpm test"
fi

# Execute
eval $CMD
```
